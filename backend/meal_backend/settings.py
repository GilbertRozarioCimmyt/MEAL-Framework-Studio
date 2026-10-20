"""
Django settings for MEAL Framework Studio Backend.
Converted from Node.js/SQLite to Django/MySQL.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# PyMySQL can substitute for mysqlclient on systems where the native C
# extension cannot be compiled (e.g. Python 3.14, Windows without build tools).
# It must be patched in BEFORE Django loads the database backend.
try:
    import MySQLdb  # noqa: F401 — native mysqlclient is preferred
except ImportError:
    try:
        import pymysql
        pymysql.install_as_MySQLdb()
    except ImportError:
        pass  # will fail later with a clear Django error

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env for local development
load_dotenv(BASE_DIR / ".env")

# -------------------------------------------------------------------------
# Core
# -------------------------------------------------------------------------
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "change-me-in-production")
DEBUG = os.environ.get("DEBUG", "False") == "True"

ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# -------------------------------------------------------------------------
# Installed apps
# -------------------------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    # Third-party
    "corsheaders",
    # Local apps
    "apps.auth_app",
    "apps.documents",
    "apps.ai_service",
    "apps.uploads",
    "apps.admin_app",
]

# -------------------------------------------------------------------------
# Middleware
# -------------------------------------------------------------------------
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "apps.auth_app.middleware.SessionAuthMiddleware",
]

ROOT_URLCONF = "meal_backend.urls"

# Store datetimes in UTC throughout the app; required when using
# timezone-aware datetime objects (datetime.now(tz=timezone.utc)).
USE_TZ = True
TIME_ZONE = "UTC"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
            ],
        },
    },
]

WSGI_APPLICATION = "meal_backend.wsgi.application"

# -------------------------------------------------------------------------
# Database — MySQL
# -------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": os.environ.get("DB_NAME", "meal_studio"),
        "USER": os.environ.get("DB_USER", "meal_user"),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "3306"),
        "OPTIONS": {
            "charset": "utf8mb4",
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}

# -------------------------------------------------------------------------
# Static files
# -------------------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# -------------------------------------------------------------------------
# Media / uploads
# -------------------------------------------------------------------------
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MEDIA_ROOT = str(UPLOAD_DIR)
MEDIA_URL = "/media/"   # not served directly; API-gated in uploads view

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB
ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".pptx", ".xlsx"}

# -------------------------------------------------------------------------
# Auth / session settings (custom — NOT django.contrib.auth)
# -------------------------------------------------------------------------
SESSION_SECRET = os.environ.get("SESSION_SECRET", "")
# SESSION_SECRET is validated lazily in auth middleware, not at settings
# import time, so migrate / management commands work without it being set.

SESSION_TTL_HOURS = int(os.environ.get("SESSION_TTL_HOURS", "16"))
COOKIE_NAME = "meal_sid"
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "False") == "True"

# -------------------------------------------------------------------------
# Anthropic AI
# -------------------------------------------------------------------------
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

ANTHROPIC_MODEL_QUICK = os.environ.get("ANTHROPIC_MODEL_QUICK", "")
ANTHROPIC_MODEL_DEFAULT = os.environ.get("ANTHROPIC_MODEL_DEFAULT", "")
ANTHROPIC_MODEL_COMPLEX = os.environ.get("ANTHROPIC_MODEL_COMPLEX", "")

# NOTE: Anthropic model IDs are validated lazily inside apps/ai_service/service.py
# on the first AI call — NOT at settings import time. This lets management commands
# (migrate, create_access_codes, etc.) run without requiring AI keys to be set.

MONTHLY_AI_REQUEST_SOFT_CAP = int(os.environ.get("MONTHLY_AI_REQUEST_SOFT_CAP", "0"))

# Optional price table for cost estimates in the usage report.
# Format: JSON string — {"<model-id>": {"in": <price_per_M_tokens>, "out": <price>}}
ANTHROPIC_MODEL_PRICES = os.environ.get("ANTHROPIC_MODEL_PRICES", "")

# -------------------------------------------------------------------------
# CORS (React frontend on a separate dev port)
# -------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",")
CORS_ALLOW_CREDENTIALS = True   # required for cookies to be sent cross-origin
CORS_EXPOSE_HEADERS = ["Content-Type", "Set-Cookie"]

# In dev (http://localhost:5173 → http://localhost:8000) cookies must be
# SameSite=None + Secure=False OR SameSite=Lax with the Vite proxy.
# The Vite dev server already proxies /api/* to :8000 so the browser sees
# only ONE origin (localhost:5173). Set COOKIE_SAMESITE=Lax for dev,
# SameSite=None in production (requires HTTPS and COOKIE_SECURE=True).
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "Lax")

# -------------------------------------------------------------------------
# Rate limiting helpers (used in views directly)
# -------------------------------------------------------------------------
LOGIN_RATE_LIMIT_MAX = 20        # per window
LOGIN_RATE_LIMIT_WINDOW = 900    # seconds (15 min)
AI_RATE_LIMIT_MAX = 20           # per window
AI_RATE_LIMIT_WINDOW = 60        # seconds (1 min)

# -------------------------------------------------------------------------
# Logging
# -------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}
