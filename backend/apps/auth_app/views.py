"""
Auth views — Python/Django translation of src/routes/auth.routes.js.

Endpoints:
    POST /api/auth/login   — validate access code, set session cookie
    GET  /api/auth/me      — return current session identity
    POST /api/auth/logout  — destroy session, clear cookie
"""
import json
import time
from collections import defaultdict
from threading import Lock

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .decorators import require_auth
from .utils import (
    find_access_code_by_code,
    create_session,
    destroy_session,
    set_session_cookie,
    clear_session_cookie,
    COOKIE_NAME,
)

# ---------------------------------------------------------------------------
# In-process rate limiter for POST /login
# Mirrors express-rate-limit(windowMs=15*60*1000, max=20) per IP.
# ---------------------------------------------------------------------------
_login_attempts: dict[str, list[float]] = defaultdict(list)
_login_lock = Lock()

LOGIN_MAX = settings.LOGIN_RATE_LIMIT_MAX        # 20
LOGIN_WINDOW = settings.LOGIN_RATE_LIMIT_WINDOW  # 900 s


def _is_rate_limited(ip: str) -> bool:
    now = time.time()
    with _login_lock:
        attempts = _login_attempts[ip]
        # prune old timestamps outside the window
        attempts[:] = [t for t in attempts if now - t < LOGIN_WINDOW]
        if len(attempts) >= LOGIN_MAX:
            return True
        attempts.append(now)
        return False


def _get_client_ip(request) -> str:
    """Respect X-Forwarded-For when behind a load balancer."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    """
    POST /api/auth/login
    Body: {"code": "<access-code>"}
    Returns: {"id", "name", "role"} + sets meal_sid cookie
    Errors: 400 bad_request, 401 invalid_code, 429 rate_limited
    """
    ip = _get_client_ip(request)
    if _is_rate_limited(ip):
        return JsonResponse(
            {"code": "rate_limited", "message": "Too many login attempts. Try again in a few minutes."},
            status=429,
        )

    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"code": "bad_request", "message": "Invalid JSON."}, status=400)

    code = body.get("code", "")
    if not code or not isinstance(code, str):
        return JsonResponse({"code": "bad_request", "message": "Enter your access code."}, status=400)

    row = find_access_code_by_code(code)
    if not row:
        return JsonResponse(
            {"code": "invalid_code", "message": "That access code isn't recognised or was revoked."},
            status=401,
        )

    session = create_session(row.id)
    response = JsonResponse({"id": row.id, "name": row.name, "role": row.role})
    set_session_cookie(response, session["token"])
    return response


@require_auth
@require_http_methods(["GET"])
def me(request):
    """
    GET /api/auth/me
    Returns current session identity: {"id", "name", "role"}
    """
    return JsonResponse({
        "id": request.auth["accessCodeId"],
        "name": request.auth["name"],
        "role": request.auth["role"],
    })


@csrf_exempt
@require_http_methods(["POST"])
def logout(request):
    """
    POST /api/auth/logout
    Destroys the session row and clears the cookie.
    """
    token = request.COOKIES.get(COOKIE_NAME)
    if token:
        destroy_session(token)
    response = JsonResponse({"ok": True})
    clear_session_cookie(response)
    return response
