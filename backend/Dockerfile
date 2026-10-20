# ============================================================
# MEAL Framework Studio — Django backend image
# ============================================================
FROM python:3.12-slim

# mysqlclient needs the MySQL dev headers at build time
RUN apt-get update && apt-get install -y --no-install-recommends \
    default-libmysqlclient-dev \
    pkg-config \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Persistent volume mount point for uploaded files
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data/uploads

# Collect static files (serves nothing at runtime — nginx / S3 handles them)
RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

# Run with gunicorn in production; override CMD for local dev
CMD ["gunicorn", "meal_backend.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "2", \
     "--timeout", "120", \
     "--access-logfile", "-"]
