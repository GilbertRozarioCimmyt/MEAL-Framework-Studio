"""
AI usage log model.

Mirrors the `ai_usage_log` table from src/db.js.
Every AI call (success or failure) is logged here — metadata only,
NEVER the prompt or response text (see SECURITY.md of the original project).
"""
from django.db import models


class AIUsageLog(models.Model):
    # ISO 8601 call-start timestamp
    ts = models.DateTimeField()
    # Who made the call — may be null if logging fails mid-session
    access_code_id = models.CharField(max_length=32, null=True, blank=True)
    # "ai.json" or "ai.text" — which HTTP endpoint
    route = models.CharField(max_length=32, null=True, blank=True)
    # Opaque feature id the frontend attaches (e.g. "proposal_analysis")
    feature = models.CharField(max_length=64, null=True, blank=True)
    # The resolved Anthropic model id used for this call
    model = models.CharField(max_length=128, null=True, blank=True)
    # Token counts — NULL on failure (no completion reached)
    input_tokens = models.IntegerField(null=True, blank=True)
    output_tokens = models.IntegerField(null=True, blank=True)
    # 1 = success, 0 = failure
    ok = models.BooleanField(default=False)
    # Mapped error code on failure: rate_limited, timeout, refused, etc.
    error_code = models.CharField(max_length=64, null=True, blank=True)
    # Short, generic user-facing message for the error code
    error_message = models.CharField(max_length=512, null=True, blank=True)
    # Wall-clock time for the call in ms
    duration_ms = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = "ai_usage_log"
        ordering = ["-ts"]

    def __str__(self):
        status = "ok" if self.ok else f"err:{self.error_code}"
        return f"[{self.ts}] {self.route}/{self.feature} {status}"
