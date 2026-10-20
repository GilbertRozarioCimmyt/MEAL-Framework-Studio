"""
AI views — Python translation of src/routes/ai.routes.js.

POST /api/ai/json  — call Claude, return parsed JSON
POST /api/ai/text  — call Claude, return {text, truncated}

Rate-limited to 20 calls/minute per access code (in-process, same approach
as the login limiter in auth/views.py).
"""
import json
import time
from collections import defaultdict
from threading import Lock

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.auth_app.decorators import require_auth
from .service import ai_json, ai_text, AIError

# ---------------------------------------------------------------------------
# Per-access-code rate limiter  (20 req/min, mirrors express-rate-limit)
# ---------------------------------------------------------------------------
_ai_attempts: dict[str, list[float]] = defaultdict(list)
_ai_lock = Lock()

AI_MAX = settings.AI_RATE_LIMIT_MAX       # 20
AI_WINDOW = settings.AI_RATE_LIMIT_WINDOW  # 60 s


def _is_rate_limited(access_code_id: str) -> bool:
    now = time.time()
    with _ai_lock:
        attempts = _ai_attempts[access_code_id]
        attempts[:] = [t for t in attempts if now - t < AI_WINDOW]
        if len(attempts) >= AI_MAX:
            return True
        attempts.append(now)
        return False


def _send_err(exc: AIError) -> JsonResponse:
    status = getattr(exc, "http_status", 500)
    return JsonResponse(
        {"code": exc.code, "message": str(exc)},
        status=status,
    )


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

@csrf_exempt
@require_auth
def json_view(request):
    """POST /api/ai/json — {prompt, opts} → parsed JSON object"""
    if request.method != "POST":
        return JsonResponse({"code": "method_not_allowed"}, status=405)

    if _is_rate_limited(request.auth["accessCodeId"]):
        return JsonResponse(
            {
                "code": "rate_limited",
                "message": "Too many AI requests in a short time — wait a moment and try again.",
            },
            status=429,
        )

    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"code": "bad_request", "message": "Invalid JSON."}, status=400)

    prompt = body.get("prompt")
    if not prompt:
        return JsonResponse({"code": "bad_request", "message": "Missing prompt."}, status=400)

    opts = body.get("opts") or {}
    try:
        result = ai_json(prompt, opts, request.auth["accessCodeId"])
        return JsonResponse(result, safe=False)
    except AIError as exc:
        return _send_err(exc)


@csrf_exempt
@require_auth
def text_view(request):
    """POST /api/ai/text — {prompt, opts} → {text, truncated}"""
    if request.method != "POST":
        return JsonResponse({"code": "method_not_allowed"}, status=405)

    if _is_rate_limited(request.auth["accessCodeId"]):
        return JsonResponse(
            {
                "code": "rate_limited",
                "message": "Too many AI requests in a short time — wait a moment and try again.",
            },
            status=429,
        )

    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"code": "bad_request", "message": "Invalid JSON."}, status=400)

    prompt = body.get("prompt")
    if not prompt:
        return JsonResponse({"code": "bad_request", "message": "Missing prompt."}, status=400)

    opts = body.get("opts") or {}
    try:
        result = ai_text(prompt, opts, request.auth["accessCodeId"])
        return JsonResponse(result)
    except AIError as exc:
        return _send_err(exc)
