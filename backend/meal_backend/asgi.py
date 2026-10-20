"""
ASGI config for MEAL Framework Studio.
"""
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "meal_backend.settings")

application = get_asgi_application()
