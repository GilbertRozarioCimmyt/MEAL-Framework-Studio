from django.urls import path
from . import views

urlpatterns = [
    path("ai-usage", views.ai_usage, name="admin-ai-usage"),
    path("access-codes", views.access_codes_list_create, name="admin-access-codes"),
    path("access-codes/<str:code_id>/revoke", views.revoke_access_code, name="admin-revoke"),
]
