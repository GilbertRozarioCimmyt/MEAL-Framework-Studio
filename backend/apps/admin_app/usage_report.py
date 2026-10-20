"""
Usage report aggregation — Python translation of src/usageReport.js.

Single source of truth consumed by both:
  - GET /api/admin/ai-usage (admin_app views)
  - manage.py command: python manage.py ai_usage_report (optional CLI)

Returns the same shape as the original getUsageReport() so the React
frontend's AdminUsage component can consume it directly.
"""
import json
import logging
from datetime import date, datetime, timezone

from django.conf import settings
from django.db import connection

logger = logging.getLogger(__name__)


def _resolve_since(since: str | None, days: int | None) -> datetime:
    if since:
        try:
            d = datetime.strptime(since, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            return d
        except ValueError:
            pass
    if days:
        from datetime import timedelta
        return datetime.now(tz=timezone.utc) - timedelta(days=int(days))
    # Default: this calendar month
    today = date.today()
    return datetime(today.year, today.month, 1, tzinfo=timezone.utc)


def _get_prices() -> dict:
    raw = settings.ANTHROPIC_MODEL_PRICES
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


def _est_cost(model: str, in_tok: int | None, out_tok: int | None, prices: dict) -> float | None:
    p = prices.get(model)
    if not p or (in_tok is None and out_tok is None):
        return None
    return ((in_tok or 0) / 1_000_000) * (p.get("in", 0)) + \
           ((out_tok or 0) / 1_000_000) * (p.get("out", 0))


def get_usage_report(since: str | None = None, days: int | None = None, daily: bool = False) -> dict:
    """
    Build the usage report dict.
    since: "YYYY-MM-DD" string | None
    days: int | None
    daily: bool — include day-by-day breakdown
    """
    since_dt = _resolve_since(since, days)
    since_iso = since_dt.isoformat()
    prices = _get_prices()
    prices_configured = bool(prices)

    with connection.cursor() as cur:
        # --- by model ---
        cur.execute(
            """
            SELECT model, ok, COUNT(*) AS n,
                   SUM(input_tokens) AS inTok, SUM(output_tokens) AS outTok,
                   AVG(duration_ms) AS avgDurationMs
            FROM ai_usage_log
            WHERE ts >= %s
            GROUP BY model, ok
            ORDER BY model, ok DESC
            """,
            [since_iso],
        )
        by_model = []
        for row in cur.fetchall():
            model, ok_val, n, in_tok, out_tok, avg_dur = row
            ok_bool = bool(ok_val)
            by_model.append({
                "model": model or "(unknown)",
                "ok": ok_bool,
                "calls": n,
                "inputTokens": in_tok or 0,
                "outputTokens": out_tok or 0,
                "avgDurationMs": round(avg_dur) if avg_dur is not None else None,
                "estCostUsd": _est_cost(model, in_tok, out_tok, prices) if ok_bool else None,
            })

        # --- by feature ---
        cur.execute(
            """
            SELECT COALESCE(feature, '(unlabeled)') AS feature, ok,
                   COUNT(*) AS n,
                   SUM(input_tokens) AS inTok, SUM(output_tokens) AS outTok
            FROM ai_usage_log
            WHERE ts >= %s
            GROUP BY feature, ok
            ORDER BY feature, ok DESC
            """,
            [since_iso],
        )
        by_feature = [
            {
                "feature": row[0],
                "ok": bool(row[1]),
                "calls": row[2],
                "inputTokens": row[3] or 0,
                "outputTokens": row[4] or 0,
            }
            for row in cur.fetchall()
        ]

        # --- by error ---
        cur.execute(
            """
            SELECT COALESCE(error_code, '(uncategorized)') AS errorCode,
                   COUNT(*) AS n,
                   MAX(ts) AS lastSeen,
                   MAX(error_message) AS sampleMessage
            FROM ai_usage_log
            WHERE ts >= %s AND ok = 0
            GROUP BY errorCode
            ORDER BY n DESC
            """,
            [since_iso],
        )
        by_error = [
            {
                "errorCode": row[0],
                "calls": row[1],
                "lastSeen": row[2],
                "sampleMessage": row[3],
            }
            for row in cur.fetchall()
        ]

        # --- by route ---
        cur.execute(
            """
            SELECT route, COUNT(*) AS n,
                   SUM(input_tokens) AS inTok, SUM(output_tokens) AS outTok
            FROM ai_usage_log
            WHERE ts >= %s AND ok = 1
            GROUP BY route
            ORDER BY route
            """,
            [since_iso],
        )
        by_route = [
            {
                "route": row[0],
                "calls": row[1],
                "inputTokens": row[2] or 0,
                "outputTokens": row[3] or 0,
            }
            for row in cur.fetchall()
        ]

        # --- daily (optional) ---
        daily_rows = None
        if daily:
            cur.execute(
                """
                SELECT SUBSTR(ts, 1, 10) AS day, model,
                       COUNT(*) AS n,
                       SUM(input_tokens) AS inTok, SUM(output_tokens) AS outTok
                FROM ai_usage_log
                WHERE ts >= %s AND ok = 1
                GROUP BY day, model
                ORDER BY day, model
                """,
                [since_iso],
            )
            daily_rows = [
                {
                    "day": row[0],
                    "model": row[1],
                    "calls": row[2],
                    "inputTokens": row[3] or 0,
                    "outputTokens": row[4] or 0,
                    "estCostUsd": _est_cost(row[1], row[3], row[4], prices),
                }
                for row in cur.fetchall()
            ]

    # --- totals ---
    total_calls = sum(r["calls"] for r in by_model)
    total_failed = sum(r["calls"] for r in by_model if not r["ok"])
    ok_rows = [r for r in by_model if r["ok"]]
    total_input = sum(r["inputTokens"] for r in ok_rows)
    total_output = sum(r["outputTokens"] for r in ok_rows)
    total_cost = sum(
        r["estCostUsd"] for r in ok_rows if r["estCostUsd"] is not None
    ) if prices_configured else None

    return {
        "sinceIso": since_iso,
        "pricesConfigured": prices_configured,
        "byModel": by_model,
        "byFeature": by_feature,
        "byError": by_error,
        "byRoute": by_route,
        "daily": daily_rows,
        "totals": {
            "totalCalls": total_calls,
            "totalFailed": total_failed,
            "totalInputTokens": total_input,
            "totalOutputTokens": total_output,
            "totalCostUsd": total_cost,
        },
    }
