"""
Uploads views — Python translation of src/routes/uploads.routes.js.

POST /api/uploads/     — accept a proposal file, store on disk, save metadata
GET  /api/uploads/<id> — stream the file back (auth + ownership checked)

Files are NEVER publicly reachable; every GET re-validates the session
cookie and ownership rule (Project Users only see their own files).
No existence leak: 404 is returned for both "not found" and "forbidden".
"""
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.auth_app.decorators import require_auth
from .models import Upload

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
ALLOWED_EXT = settings.ALLOWED_UPLOAD_EXTENSIONS
MAX_BYTES = settings.MAX_UPLOAD_BYTES


@csrf_exempt
@require_auth
def upload_file(request):
    """POST /api/uploads/  — multipart form with field 'file'."""
    if request.method != "POST":
        return JsonResponse({"code": "method_not_allowed"}, status=405)

    f = request.FILES.get("file")
    if not f:
        return JsonResponse({"code": "bad_request", "message": "No file received."}, status=400)

    # Extension check
    name = f.name or ""
    ext = Path(name).suffix.lower()
    if ext not in ALLOWED_EXT:
        return JsonResponse(
            {"code": "bad_request", "message": "File type not allowed."},
            status=400,
        )

    # Size check
    if f.size > MAX_BYTES:
        return JsonResponse(
            {"code": "bad_request", "message": "File exceeds 25 MB limit."},
            status=400,
        )

    upload_id = secrets.token_hex(16)
    stored_filename = upload_id + ext
    dest = UPLOAD_DIR / stored_filename

    with open(dest, "wb") as out:
        for chunk in f.chunks():
            out.write(chunk)

    Upload.objects.create(
        id=upload_id,
        stored_filename=stored_filename,
        original_filename=f.name,
        content_type=f.content_type,
        size_bytes=f.size,
        owner_access_code_id=request.auth["accessCodeId"],
        created_at=datetime.now(tz=timezone.utc),
    )

    return JsonResponse({
        "id": upload_id,
        "url": f"/api/uploads/{upload_id}",
        "sizeBytes": f.size,
        "contentType": f.content_type,
    })


@require_auth
def get_upload(request, upload_id: str):
    """GET /api/uploads/<id> — stream the file (ownership checked)."""
    if request.method != "GET":
        return JsonResponse({"code": "method_not_allowed"}, status=405)

    try:
        row = Upload.objects.get(id=upload_id)
    except Upload.DoesNotExist:
        return JsonResponse({}, status=404)

    # Project Users only see their own files — no existence leak
    if (
        request.auth["role"] == "Project User"
        and row.owner_access_code_id != request.auth["accessCodeId"]
    ):
        return JsonResponse({}, status=404)

    file_path = UPLOAD_DIR / row.stored_filename
    if not file_path.exists():
        return JsonResponse({}, status=404)

    safe_name = (row.original_filename or "file").replace('"', "")
    response = FileResponse(
        open(file_path, "rb"),
        content_type=row.content_type or "application/octet-stream",
    )
    response["Content-Disposition"] = f'inline; filename="{safe_name}"'
    return response
