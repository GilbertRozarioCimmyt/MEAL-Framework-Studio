"""
Auth decorators — drop-in equivalents of requireAuth and requireAdmin
Express middleware from src/auth.js.

Usage:
    @require_auth
    def my_view(request):
        # request.auth is guaranteed to be set
        ...

    @require_auth
    @require_admin
    def admin_view(request):
        ...
"""
import functools
from django.http import JsonResponse


def require_auth(view_func):
    """Return 401 if request.auth is None (no session / expired / revoked)."""
    @functools.wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.auth:
            return JsonResponse(
                {"code": "not_declared", "message": "Not logged in or session expired."},
                status=401,
            )
        return view_func(request, *args, **kwargs)
    return wrapper


def require_admin(view_func):
    """Return 403 if the authenticated user is not an Administrator."""
    @functools.wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.auth or request.auth.get("role") != "Administrator":
            return JsonResponse(
                {"code": "forbidden", "message": "Administrator role required."},
                status=403,
            )
        return view_func(request, *args, **kwargs)
    return wrapper
