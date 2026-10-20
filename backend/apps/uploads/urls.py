from django.urls import path
from . import views

urlpatterns = [
    path("", views.upload_file, name="upload-create"),
    path("<str:upload_id>", views.get_upload, name="upload-get"),
]
