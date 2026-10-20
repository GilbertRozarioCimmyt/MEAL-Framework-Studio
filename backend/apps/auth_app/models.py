"""
Auth models — AccessCode and Session.

Direct MySQL equivalents of the SQLite tables in the original src/db.js.
We deliberately do NOT use Django's built-in User / auth system because
the original design uses high-entropy random access codes (not passwords),
and role/ownership logic must stay identical to the Node.js version.
"""
from django.db import models


class AccessCode(models.Model):
    """
    One access code per workshop participant.
    The raw code is NEVER stored — only the HMAC-SHA256 digest.
    The plaintext code is returned exactly once (at creation) then
    discarded, matching the original behaviour in src/auth.js.
    """

    ROLE_PROJECT_USER = "Project User"
    ROLE_ME_REVIEWER = "M&E Reviewer"
    ROLE_ADMINISTRATOR = "Administrator"

    ROLE_CHOICES = [
        (ROLE_PROJECT_USER, "Project User"),
        (ROLE_ME_REVIEWER, "M&E Reviewer"),
        (ROLE_ADMINISTRATOR, "Administrator"),
    ]

    # "ac_" + 8 random bytes (hex) — matches original id format
    id = models.CharField(max_length=32, primary_key=True)
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True, null=True)
    role = models.CharField(max_length=32, choices=ROLE_CHOICES)
    # HMAC-SHA256(SESSION_SECRET, normalised_code) — never the raw code
    code_hash = models.CharField(max_length=64, unique=True)
    revoked = models.BooleanField(default=False)
    created_at = models.DateTimeField()

    class Meta:
        db_table = "access_codes"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.role})"


class Session(models.Model):
    """
    Server-side session row.  The token value is also the cookie value
    (meal_sid).  Expiry is checked by the middleware on every request.
    """

    # 32 random bytes (hex)
    token = models.CharField(max_length=64, primary_key=True)
    access_code = models.ForeignKey(
        AccessCode,
        on_delete=models.CASCADE,
        related_name="sessions",
        db_column="access_code_id",
    )
    created_at = models.DateTimeField()
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "sessions"

    def __str__(self):
        return f"Session({self.access_code_id}, expires={self.expires_at})"
