"""
Upload model — metadata for proposal files stored on disk.

Mirrors the SQLite `uploads` table in src/db.js.
Files are NEVER publicly served; every GET re-checks the session cookie
and ownership (same rule as projects).
"""
from django.db import models


class Upload(models.Model):
    # 16 random bytes (hex); also the stored filename's base
    id = models.CharField(max_length=32, primary_key=True)
    # id + original extension, e.g. "abcdef0123456789.pdf"
    stored_filename = models.CharField(max_length=255)
    original_filename = models.CharField(max_length=255, null=True, blank=True)
    content_type = models.CharField(max_length=128, null=True, blank=True)
    size_bytes = models.BigIntegerField(null=True, blank=True)
    owner_access_code_id = models.CharField(max_length=32)
    created_at = models.DateTimeField()

    class Meta:
        db_table = "uploads"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.original_filename} ({self.id})"
