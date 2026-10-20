"""
Session-auth middleware — Python equivalent of requireAuth / requireAdmin
from src/auth.js.

Reads the meal_sid cookie on every request and attaches:
    request.auth = {accessCodeId, name, role}  — if valid session
    request.auth = None                         — if missing / expired / revoked

Views then call require_auth() or require_admin() decorators (below) rather
than importing the middleware directly.
"""
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from .utils import get_session, COOKIE_NAME


class SessionAuthMiddleware:
    """Resolve the session cookie into request.auth on every request."""

    def __init__(self, get_response):
        # Validate SESSION_SECRET here (once at startup of the actual server,
        # not during manage.py commands like migrate or makemigrations).
        if not settings.SESSION_SECRET:
            raise ImproperlyConfigured(
                "SESSION_SECRET is not set. Generate one with:\n"
                "  python -c \"import secrets; print(secrets.token_hex(32))\"\n"
                "and add it to your .env file."
            )
        self.get_response = get_response

    def __call__(self, request):
        token = request.COOKIES.get(COOKIE_NAME)
        request.auth = get_session(token) if token else None
        return self.get_response(request)
