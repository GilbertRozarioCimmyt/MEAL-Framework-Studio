"""
Document-store views — Python translation of src/routes/db.routes.js.

Two URL-dispatched views:
  collection_view  → GET /api/db/<collection>
  document_view    → GET | PUT | DELETE /api/db/<collection>/<doc_id>

All routes require authentication via @require_auth.
"""
import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.auth_app.decorators import require_auth
from . import store


def _handle_store_error(exc) -> JsonResponse:
    code = getattr(exc, "code", None)
    if code == "forbidden":
        return JsonResponse({"code": "forbidden", "message": str(exc)}, status=403)
    return JsonResponse({"code": "server_error", "message": "Something went wrong."}, status=500)


@csrf_exempt
@require_auth
def collection_view(request, collection: str):
    """
    GET /api/db/<collection>
    Returns {docs: [{id, data}]} filtered by caller's visibility.
    """
    if request.method != "GET":
        return JsonResponse({"code": "method_not_allowed"}, status=405)
    try:
        docs = store.list_collection(collection, request.auth)
        return JsonResponse({"docs": docs})
    except Exception as exc:
        return _handle_store_error(exc)


@csrf_exempt
@require_auth
def document_view(request, collection: str, doc_id: str):
    """
    GET    /api/db/<collection>/<doc_id>  → {exists, data}
    PUT    /api/db/<collection>/<doc_id>  → upsert; body = raw document
    DELETE /api/db/<collection>/<doc_id>  → {ok: true}
    """
    if request.method == "GET":
        try:
            result = store.get_doc(collection, doc_id, request.auth)
            return JsonResponse(result)
        except Exception as exc:
            return _handle_store_error(exc)

    elif request.method == "PUT":
        try:
            body = json.loads(request.body or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"code": "bad_request", "message": "Invalid JSON."}, status=400)
        try:
            result = store.set_doc(collection, doc_id, body, request.auth)
            return JsonResponse(result)
        except Exception as exc:
            return _handle_store_error(exc)

    elif request.method == "DELETE":
        try:
            store.delete_doc(collection, doc_id, request.auth)
            return JsonResponse({"ok": True})
        except Exception as exc:
            return _handle_store_error(exc)

    return JsonResponse({"code": "method_not_allowed"}, status=405)
