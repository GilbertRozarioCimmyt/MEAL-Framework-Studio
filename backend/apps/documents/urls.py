from django.urls import path
from . import views

urlpatterns = [
    # GET  /api/db/<collection>
    path("<str:collection>", views.collection_view, name="doc-collection"),
    # GET | PUT | DELETE  /api/db/<collection>/<doc_id>
    path("<str:collection>/<path:doc_id>", views.document_view, name="doc-item"),
]
