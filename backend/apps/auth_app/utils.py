"""
Auth utilities — direct Python translation of src/auth.js.

Key design decisions preserved from the original:
- Access codes are HIGH-ENTROPY random tokens, not human-chosen passwords,
  so fast HMAC-SHA256 is correct here (not bcrypt/scrypt).
- The raw code is returned ONCE at creation and never stored — only its
  HMAC digest lives in the database.
- Rotating SESSION_SECRET invalidates every code and session at once.
"""
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from django.conf import settings

from .models import AccessCode, Session


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize_code(raw: str) -> str:
    """Strip whitespace, upper-case — mirrors normalizeCode() in auth.js."""
    return str(raw or "").strip().upper().replace(" ", "")


def hash_code(code: str) -> str:
    """HMAC-SHA256(SESSION_SECRET, normalised_code) → hex digest."""
    pepper = settings.SESSION_SECRET.encode()
    return hmac.new(pepper, normalize_code(code).encode(), hashlib.sha256).hexdigest()


def generate_code() -> str:
    """
    10 characters from an unambiguous base-32 alphabet, formatted XXXXX-XXXXX.
    Matches generateCode() in auth.js — easy to read aloud from a handout.
    """
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    raw = bytes(secrets.token_bytes(10))
    out = "".join(alphabet[b % len(alphabet)] for b in raw)[:10]
    return out[:5] + "-" + out[5:]


# ---------------------------------------------------------------------------
# Access codes
# ---------------------------------------------------------------------------

def create_access_code(name: str, email: str | None, role: str) -> dict:
    """
    Create one access code row and return the plaintext code (once only).
    Mirrors createAccessCode() in auth.js.
    """
    ac_id = "ac_" + secrets.token_hex(8)
    code = generate_code()
    AccessCode.objects.create(
        id=ac_id,
        name=name,
        email=email or None,
        role=role,
        code_hash=hash_code(code),
        revoked=False,
        created_at=datetime.now(tz=timezone.utc),
    )
    return {"id": ac_id, "name": name, "email": email, "role": role, "code": code}


def find_access_code_by_code(code: str) -> AccessCode | None:
    """Look up an active AccessCode by its plaintext code value."""
    digest = hash_code(code)
    return AccessCode.objects.filter(code_hash=digest, revoked=False).first()


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

def create_session(access_code_id: str) -> dict:
    """
    Create a new session row and return the token + expiry.
    Mirrors createSession() in auth.js.
    """
    token = secrets.token_hex(32)
    now = datetime.now(tz=timezone.utc)
    expires = now + timedelta(hours=settings.SESSION_TTL_HOURS)
    Session.objects.create(
        token=token,
        access_code_id=access_code_id,
        created_at=now,
        expires_at=expires,
    )
    return {"token": token, "expires_at": expires}


def get_session(token: str) -> dict | None:
    """
    Validate a session token and return {accessCodeId, name, role} or None.
    Mirrors getSession() in auth.js — checks expiry and revoked flag.
    """
    if not token:
        return None
    try:
        row = (
            Session.objects
            .select_related("access_code")
            .get(token=token)
        )
    except Session.DoesNotExist:
        return None

    ac = row.access_code
    if ac.revoked:
        return None
    if row.expires_at < datetime.now(tz=timezone.utc):
        return None

    return {
        "accessCodeId": ac.id,
        "name": ac.name,
        "role": ac.role,
    }


def destroy_session(token: str) -> None:
    """Delete a session row by token. Mirrors destroySession() in auth.js."""
    Session.objects.filter(token=token).delete()


# ---------------------------------------------------------------------------
# Cookie helpers
# ---------------------------------------------------------------------------

COOKIE_NAME = settings.COOKIE_NAME


def set_session_cookie(response, token: str) -> None:
    """Set the httpOnly session cookie on a Django response."""
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=settings.SESSION_TTL_HOURS * 3600,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )


def clear_session_cookie(response) -> None:
    """Clear the session cookie."""
    response.delete_cookie(COOKIE_NAME, path="/")
