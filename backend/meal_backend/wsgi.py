"""
WSGI config for MEAL Framework Studio.
"""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "meal_backend.settings")

application = get_wsgi_application()
