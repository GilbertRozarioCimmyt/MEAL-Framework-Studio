"""
AI service — Python translation of src/ai.js.
...
"""
import json
import logging
import re
import time
from datetime import datetime, timezone

from django.conf import settings

from .models import AIUsageLog

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model / token configuration  (mirrors MODEL_BY_TIER in src/ai.js)
# ---------------------------------------------------------------------------
MODEL_BY_TIER = {
    "quick": settings.ANTHROPIC_MODEL_QUICK,
    "default": settings.ANTHROPIC_MODEL_DEFAULT,
    "complex": settings.ANTHROPIC_MODEL_COMPLEX,
}

MAX_TOKENS_BY_TIER = {
    "quick": 1024,
    "default": 4096,
    "complex": 8192,
}

# Validate on first use, not at settings load time, so management commands
# (migrate, create_access_codes, etc.) work without AI keys being set.
def _get_client():
    import anthropic as _anthropic  # lazy — not needed for migrate/admin commands
    missing = [k.upper() for k, v in MODEL_BY_TIER.items() if not v]
    if missing:
        raise RuntimeError(
            f"Missing Anthropic model IDs: ANTHROPIC_MODEL_{', ANTHROPIC_MODEL_'.join(missing)}. "
            "Copy the exact model IDs from your Anthropic Console. See .env.example."
        )
    if not settings.ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY is not set. See .env.example.")
    return _anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


_client_instance = None

def _client():
    global _client_instance
    if _client_instance is None:
        _client_instance = _get_client()
    return _client_instance


# ---------------------------------------------------------------------------
# Soft cap
# ---------------------------------------------------------------------------
def _check_soft_cap():
    cap = settings.MONTHLY_AI_REQUEST_SOFT_CAP
    if not cap:
        return
    from datetime import date
    month_start = datetime(
        date.today().year, date.today().month, 1, tzinfo=timezone.utc
    )
    n = AIUsageLog.objects.filter(ts__gte=month_start).count()
    if n >= cap:
        err = RuntimeError("Monthly AI request soft cap reached.")
        err.code = "rate_limited"
        err.http_status = 429
        raise err


# ---------------------------------------------------------------------------
# Error mapping  (mirrors mapAnthropicError in src/ai.js)
# ---------------------------------------------------------------------------
class AIError(Exception):
    def __init__(self, code: str, message: str, http_status: int = 500):
        super().__init__(message)
        self.code = code
        self.http_status = http_status


def _map_error(exc) -> AIError:
    # Lazy import — only needed when an error actually occurs during an AI call
    try:
        import anthropic as _anthropic
        if isinstance(exc, _anthropic.RateLimitError):
            return AIError("rate_limited", "Rate limited — try again shortly.", 429)
        if isinstance(exc, _anthropic.BadRequestError):
            msg = str(exc)
            if re.search(r"prompt is too long|maximum context length", msg, re.I):
                return AIError("prompt_too_large", "The request was too large for the model.", 400)
        if isinstance(exc, (_anthropic.AuthenticationError, _anthropic.PermissionDeniedError)):
            return AIError("sampling_disabled", "AI assistance isn't enabled for this account.", 500)
    except ImportError:
        pass
    if isinstance(exc, TimeoutError):
        return AIError("timeout", "The AI request timed out.", 504)
    return AIError("refused", str(exc) or "The AI request failed.", 502)


# ---------------------------------------------------------------------------
# Usage logging  (best-effort)
# ---------------------------------------------------------------------------
def _log_usage(
    access_code_id, route, feature, model, usage, ok, error_code, error_message, duration_ms
):
    try:
        AIUsageLog.objects.create(
            ts=datetime.now(tz=timezone.utc),
            access_code_id=access_code_id or None,
            route=route,
            feature=feature or None,
            model=model,
            input_tokens=(usage.input_tokens if usage else None),
            output_tokens=(usage.output_tokens if usage else None),
            ok=ok,
            error_code=error_code or None,
            error_message=error_message or None,
            duration_ms=round(duration_ms) if duration_ms is not None else None,
        )
    except Exception as log_exc:
        logger.error("ai usage logging failed: %s", log_exc)


# ---------------------------------------------------------------------------
# Code-fence stripper  (mirrors stripCodeFence in src/ai.js)
# ---------------------------------------------------------------------------
def _strip_code_fence(text: str) -> str:
    t = str(text or "").strip()
    m = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", t, re.IGNORECASE)
    return m.group(1) if m else t


# ---------------------------------------------------------------------------
# Core Anthropic call  (mirrors callClaude in src/ai.js)
# ---------------------------------------------------------------------------
def _call_claude(
    prompt,
    system: str | None = None,
    model_tier: str = "default",
    max_tokens_override: int | None = None,
    timeout_ms: int = 100_000,
) -> dict:
    """
    Returns {"text": str, "usage": usage_obj, "model": str}.
    Raises AIError on any failure.
    """
    _check_soft_cap()

    model = MODEL_BY_TIER.get(model_tier, MODEL_BY_TIER["default"])
    max_tokens = max_tokens_override or MAX_TOKENS_BY_TIER.get(model_tier, 4096)

    messages = (
        prompt if isinstance(prompt, list)
        else [{"role": "user", "content": prompt}]
    )

    kwargs: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system:
        kwargs["system"] = system

    try:
        resp = _client().messages.create(**kwargs, timeout=timeout_ms / 1000)
    except Exception as exc:
        # Lazy-import the Anthropic exception classes for isinstance checks
        try:
            import anthropic as _anthropic
            if isinstance(exc, _anthropic.APITimeoutError):
                raise AIError("timeout", "The AI request timed out.", 504) from exc
            if isinstance(exc, _anthropic.APIError):
                raise _map_error(exc) from exc
        except ImportError:
            pass
        raise _map_error(exc) from exc

    text_block = next((b for b in resp.content if b.type == "text"), None)
    text = text_block.text if text_block else ""

    if not text.strip():
        raise AIError("empty_completion", "Empty completion from the model.", 502)

    return {"text": text, "usage": resp.usage, "model": model}


# ---------------------------------------------------------------------------
# Public API  (mirrors aiJson / aiText in src/ai.js)
# ---------------------------------------------------------------------------

def ai_json(prompt, opts: dict, access_code_id: str | None):
    """
    Call Claude expecting JSON output.  One corrective retry if the first
    response isn't valid JSON (matches the retry logic in src/ai.js).
    """
    model_tier = (opts or {}).get("modelTier", "default")
    timeout_ms = (opts or {}).get("timeoutMs", 100_000)
    feature = (opts or {}).get("feature")
    started = time.time()

    try:
        result = _call_claude(
            prompt,
            system=(
                "Reply with ONLY a single valid JSON value — "
                "no markdown code fences, no commentary before or after it."
            ),
            model_tier=model_tier,
            timeout_ms=timeout_ms,
        )
        text = result["text"]
        usage = result["usage"]
        model = result["model"]

        try:
            parsed = json.loads(_strip_code_fence(text))
        except json.JSONDecodeError:
            # One corrective retry
            retry = _call_claude(
                prompt=(
                    prompt if isinstance(prompt, list)
                    else [{"role": "user", "content": prompt}]
                ) + [
                    {"role": "assistant", "content": text},
                    {
                        "role": "user",
                        "content": (
                            "That was not valid JSON. "
                            "Reply again with ONLY valid JSON, nothing else."
                        ),
                    },
                ],
                system="Reply with ONLY a single valid JSON value — no markdown code fences, no commentary.",
                model_tier=model_tier,
                timeout_ms=timeout_ms,
            )
            parsed = json.loads(_strip_code_fence(retry["text"]))
            usage = retry["usage"]
            model = retry["model"]

        _log_usage(
            access_code_id, "ai.json", feature, model, usage,
            True, None, None, (time.time() - started) * 1000
        )
        return parsed

    except AIError as exc:
        _log_usage(
            access_code_id, "ai.json", feature,
            MODEL_BY_TIER.get(model_tier),
            None, False, exc.code, str(exc),
            (time.time() - started) * 1000,
        )
        raise
    except Exception as exc:
        mapped = _map_error(exc)
        _log_usage(
            access_code_id, "ai.json", feature,
            MODEL_BY_TIER.get(model_tier),
            None, False, mapped.code, str(mapped),
            (time.time() - started) * 1000,
        )
        raise mapped from exc


def ai_text(prompt, opts: dict, access_code_id: str | None):
    """
    Call Claude expecting free-text output.
    Returns {"text": str, "truncated": False}.
    """
    model_tier = (opts or {}).get("modelTier", "default")
    timeout_ms = (opts or {}).get("timeoutMs", 100_000)
    feature = (opts or {}).get("feature")
    started = time.time()

    try:
        result = _call_claude(
            prompt, model_tier=model_tier, timeout_ms=timeout_ms
        )
        _log_usage(
            access_code_id, "ai.text", feature,
            result["model"], result["usage"],
            True, None, None, (time.time() - started) * 1000,
        )
        return {"text": result["text"], "truncated": False}

    except AIError as exc:
        _log_usage(
            access_code_id, "ai.text", feature,
            MODEL_BY_TIER.get(model_tier),
            None, False, exc.code, str(exc),
            (time.time() - started) * 1000,
        )
        raise
    except Exception as exc:
        mapped = _map_error(exc)
        _log_usage(
            access_code_id, "ai.text", feature,
            MODEL_BY_TIER.get(model_tier),
            None, False, mapped.code, str(mapped),
            (time.time() - started) * 1000,
        )
        raise mapped from exc
