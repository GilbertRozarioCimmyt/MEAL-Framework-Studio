"""
Admin views — Python translation of src/routes/admin.routes.js.

All routes require Administrator role (enforced via @require_admin).

GET  /api/admin/ai-usage                — usage & error report
GET  /api/admin/access-codes            — list all participants
POST /api/admin/access-codes            — create one
POST /api/admin/access-codes/<id>/revoke — revoke + kill sessions
"""
import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.auth_app.decorators import require_auth, require_admin
from apps.auth_app.models import AccessCode, Session
from apps.auth_app.utils import create_access_code
from .usage_report import get_usage_report

VALID_ROLES = {"Project User", "M&E Reviewer", "Administrator"}


@require_auth
@require_admin
def ai_usage(request):
    """
    GET /api/admin/ai-usage
    Query params: since=YYYY-MM-DD, days=N (since wins), daily=1
    """
    if request.method != "GET":
        return JsonResponse({"code": "method_not_allowed"}, status=405)

    since = request.GET.get("since")
    days_raw = request.GET.get("days")
    days = int(days_raw) if days_raw and days_raw.isdigit() else None
    daily = request.GET.get("daily") in ("1", "true")

    try:
        report = get_usage_report(since=since, days=days, daily=daily)
        return JsonResponse(report)
    except Exception as exc:
        return JsonResponse(
            {"code": "server_error", "message": "Could not build the usage report."},
            status=500,
        )


@require_auth
@require_admin
def access_codes_list_create(request):
    """
    GET  /api/admin/access-codes  — list all (no hashes, no raw codes)
    POST /api/admin/access-codes  — create one; plaintext code returned once
    """
    if request.method == "GET":
        rows = AccessCode.objects.values(
            "id", "name", "email", "role", "revoked", "created_at"
        ).order_by("-created_at")
        return JsonResponse({"accessCodes": list(rows)})

    if request.method == "POST":
        try:
            body = json.loads(request.body or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"code": "bad_request", "message": "Invalid JSON."}, status=400)

        name = body.get("name", "").strip()
        email = body.get("email", "").strip() or None
        role = body.get("role", "").strip()

        if not name or not role:
            return JsonResponse(
                {"code": "bad_request", "message": "name and role are required."},
                status=400,
            )
        if role not in VALID_ROLES:
            return JsonResponse(
                {"code": "bad_request", "message": "Invalid role."},
                status=400,
            )

        created = create_access_code(name=name, email=email, role=role)
        # The raw code is returned EXACTLY ONCE here — it is never retrievable again
        return JsonResponse(created, status=201)

    return JsonResponse({"code": "method_not_allowed"}, status=405)


@csrf_exempt
@require_auth
@require_admin
def revoke_access_code(request, code_id: str):
    """
    POST /api/admin/access-codes/<id>/revoke
    Sets revoked=True and immediately deletes all sessions for that holder.
    """
    if request.method != "POST":
        return JsonResponse({"code": "method_not_allowed"}, status=405)

    AccessCode.objects.filter(id=code_id).update(revoked=True)
    Session.objects.filter(access_code_id=code_id).delete()
    return JsonResponse({"ok": True})
