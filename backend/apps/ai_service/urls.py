from django.urls import path
from . import views

urlpatterns = [
    path("json", views.json_view, name="ai-json"),
    path("text", views.text_view, name="ai-text"),
]
