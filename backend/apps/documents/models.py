"""
Document model — generic JSON document store.

Mirrors the SQLite `documents` table in src/db.js.  The frontend talks
to this as a collection/doc_id key-value store, exactly as it talked to
the Claude Artifact `db` capability.  No schema is imposed on `data`
beyond being valid JSON — the application logic lives in store.py.

Collections used by the frontend:
  - projects            (owned: Project User sees only their own)
  - proposal_chunks     (owned: inherits from parent project)
  - kpi_suggestions     (institution-wide)
  - notifications       (institution-wide)
  - settings            (institution-wide)
  - kpi_overrides       (institution-wide)
"""
from django.db import models


class Document(models.Model):
    # e.g. "projects", "proposal_chunks", "kpi_suggestions", …
    # 64 chars × 4 bytes (utf8mb4) = 256 bytes of index space
    collection = models.CharField(max_length=64)
    # app-generated; for proposal_chunks shaped "<projectId>__<n>"
    # 186 chars × 4 bytes = 744 bytes → combined 256+744 = 1000 bytes (MySQL limit)
    doc_id = models.CharField(max_length=186)
    # full document serialised as JSON text (not JSONField so we control
    # serialisation exactly like the original JSON.stringify / JSON.parse)
    data = models.TextField()
    # NULL for institution-wide collections; set to the owning access_code
    # id for owned collections (projects, proposal_chunks)
    owner_access_code_id = models.CharField(max_length=32, null=True, blank=True)
    updated_at = models.DateTimeField()

    class Meta:
        db_table = "documents"
        unique_together = [("collection", "doc_id")]

    def __str__(self):
        return f"{self.collection}/{self.doc_id}"
