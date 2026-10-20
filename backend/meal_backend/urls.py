"""
Root URL configuration for MEAL Framework Studio.

Maps the same API surface as the original Express app:
  /api/auth/    → apps.auth_app
  /api/db/      → apps.documents
  /api/ai/      → apps.ai_service
  /api/uploads/ → apps.uploads
  /api/admin/   → apps.admin_app
  /healthz      → inline health check
"""
from django.http import JsonResponse
from django.urls import path, include


def healthz(request):
    return JsonResponse({"ok": True})


urlpatterns = [
    path("healthz", healthz, name="healthz"),
    path("api/auth/", include("apps.auth_app.urls")),
    path("api/db/", include("apps.documents.urls")),
    path("api/ai/", include("apps.ai_service.urls")),
    path("api/uploads/", include("apps.uploads.urls")),
    path("api/admin/", include("apps.admin_app.urls")),
]
