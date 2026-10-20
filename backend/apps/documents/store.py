"""
Generic document store — Python translation of src/docs.js.

Preserves the same ownership model:
  - "projects" and "proposal_chunks" are OWNED — Project Users see only
    their own; M&E Reviewers and Administrators see everything.
  - All other collections (kpi_suggestions, notifications, settings,
    kpi_overrides) are institution-wide.

This is the fix for the original Claude Artifact security bug where any
viewer could self-declare their role client-side and read all projects.
"""
import json
from datetime import datetime, timezone

from django.db import transaction

from .models import Document

# Collections whose docs are per-participant
OWNED_COLLECTIONS = {"projects", "proposal_chunks"}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _forbidden(message="Not allowed."):
    err = PermissionError(message)
    err.code = "forbidden"
    return err


def _resolve_project_id(collection: str, doc_id: str) -> str | None:
    """Return the project id that governs ownership for a given doc."""
    if collection == "projects":
        return doc_id
    if collection == "proposal_chunks":
        return doc_id.split("__")[0]
    return None


def _get_owner_of_project(project_id: str) -> str | None:
    try:
        row = Document.objects.get(collection="projects", doc_id=project_id)
        return row.owner_access_code_id
    except Document.DoesNotExist:
        return None


def _can_see(auth: dict, owner_access_code_id: str | None) -> bool:
    """
    M&E Reviewer and Administrator always see everything.
    Project User only sees docs they own (or docs with no owner).
    """
    if auth["role"] != "Project User":
        return True
    if not owner_access_code_id:
        return True
    return owner_access_code_id == auth["accessCodeId"]


# ---------------------------------------------------------------------------
# Public API — mirrors the four functions exported by src/docs.js
# ---------------------------------------------------------------------------

def list_collection(collection: str, auth: dict) -> list:
    """Return all docs in a collection visible to the caller."""
    rows = Document.objects.filter(collection=collection)
    result = []
    for row in rows:
        if _can_see(auth, row.owner_access_code_id):
            result.append({"id": row.doc_id, "data": json.loads(row.data)})
    return result


def get_doc(collection: str, doc_id: str, auth: dict) -> dict:
    """
    Return {exists, data} — exists=False both when missing and when the
    caller is forbidden (no existence leak for Project Users).
    """
    try:
        row = Document.objects.get(collection=collection, doc_id=doc_id)
    except Document.DoesNotExist:
        return {"exists": False, "data": None}

    if not _can_see(auth, row.owner_access_code_id):
        return {"exists": False, "data": None}

    return {"exists": True, "data": json.loads(row.data)}


@transaction.atomic
def set_doc(collection: str, doc_id: str, data: dict, auth: dict) -> dict:
    """
    Upsert a document.  Ownership is enforced:
    - Creating a project → owner = caller
    - Updating a project → owner unchanged; caller must already own it
    - proposal_chunks inherit owner from parent project
    - Institution-wide collections: preserve existing owner or set caller
    """
    try:
        existing = Document.objects.select_for_update().get(
            collection=collection, doc_id=doc_id
        )
    except Document.DoesNotExist:
        existing = None

    owner_access_code_id = None

    if collection in OWNED_COLLECTIONS:
        if collection == "projects":
            if existing:
                if not _can_see(auth, existing.owner_access_code_id):
                    raise _forbidden()
                owner_access_code_id = existing.owner_access_code_id
            else:
                owner_access_code_id = auth["accessCodeId"]

        elif collection == "proposal_chunks":
            project_id = _resolve_project_id(collection, doc_id)
            project_owner = _get_owner_of_project(project_id) if project_id else None
            if not _can_see(auth, project_owner):
                raise _forbidden()
            owner_access_code_id = project_owner
    else:
        owner_access_code_id = (
            existing.owner_access_code_id if existing else auth["accessCodeId"]
        )

    data_str = json.dumps(data, ensure_ascii=False)
    now = datetime.now(tz=timezone.utc)

    if existing:
        existing.data = data_str
        existing.owner_access_code_id = owner_access_code_id
        existing.updated_at = now
        existing.save(update_fields=["data", "owner_access_code_id", "updated_at"])
    else:
        Document.objects.create(
            collection=collection,
            doc_id=doc_id,
            data=data_str,
            owner_access_code_id=owner_access_code_id,
            updated_at=now,
        )

    return {"id": doc_id, "data": data}


def delete_doc(collection: str, doc_id: str, auth: dict) -> None:
    """Delete a document.  Same ownership check as set_doc."""
    if collection in OWNED_COLLECTIONS:
        project_id = _resolve_project_id(collection, doc_id)
        owner = _get_owner_of_project(project_id) if project_id else None
        if not _can_see(auth, owner):
            raise _forbidden()

    Document.objects.filter(collection=collection, doc_id=doc_id).delete()
