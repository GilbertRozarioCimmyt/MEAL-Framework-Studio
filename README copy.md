# MEAL Framework Studio — React + Django + MySQL

Converted from the original Node.js/Express/SQLite stack to:

| Layer    | Technology                         |
|----------|------------------------------------|
| Frontend | React 18, Vite, React Router v6    |
| Backend  | Django 5.1, Python 3.12, Gunicorn  |
| Database | MySQL 8.4                          |
| Auth     | Custom session cookies (HMAC-SHA256 access codes) |
| AI       | Anthropic SDK (Claude)             |
| Deploy   | Docker Compose / nginx             |

---

## Project structure

```
converted-app/
├── backend/                   # Django project
│   ├── manage.py
│   ├── meal_backend/          # settings, urls, wsgi, asgi
│   ├── apps/
│   │   ├── auth_app/          # access codes, sessions, middleware
│   │   ├── documents/         # generic document store (collection/doc_id)
│   │   ├── ai_service/        # Anthropic proxy + usage log
│   │   ├── uploads/           # file upload/download
│   │   └── admin_app/         # access-code admin + AI usage report
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
│
├── frontend/                  # React app
│   ├── src/
│   │   ├── App.jsx            # router + auth gate
│   │   ├── context/           # AuthContext
│   │   ├── api/               # fetch wrappers for every endpoint
│   │   ├── components/        # all UI components
│   │   └── styles/index.css   # design system
│   ├── public/
│   │   ├── data/              # kpis.json, volumes.json, project-types.json
│   │   └── assets/            # CIMMYT logo
│   ├── package.json
│   ├── vite.config.js
│   ├── nginx.conf
│   └── Dockerfile
│
└── docker-compose.yml         # MySQL + Django + React (nginx)
```

---

## Quick start (Docker Compose)

```bash
# 1. Copy and fill in backend secrets
cp backend/.env.example backend/.env
# Edit backend/.env — at minimum set:
#   DJANGO_SECRET_KEY, SESSION_SECRET, DB_PASSWORD,
#   ANTHROPIC_API_KEY, ANTHROPIC_MODEL_QUICK/DEFAULT/COMPLEX

# 2. Start everything
docker compose up --build

# 3. Create the first access code (Administrator)
docker compose exec backend python manage.py create_access_codes \
  --name "Workshop Admin" --role "Administrator"

# 4. Open http://localhost and sign in with the printed code
```

---

## Local development (without Docker)

### Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env (see above)

# Ensure MySQL is running and the database/user exist:
# CREATE DATABASE meal_studio CHARACTER SET utf8mb4;
# CREATE USER 'meal_user'@'localhost' IDENTIFIED BY 'yourpassword';
# GRANT ALL PRIVILEGES ON meal_studio.* TO 'meal_user'@'localhost';

# Apply migrations
python manage.py migrate

# Create an admin access code
python manage.py create_access_codes --name "Admin" --role "Administrator"

# Run the dev server
python manage.py runserver 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 — proxies /api/* to :8000
```

---

## Management commands

| Command | Purpose |
|---------|---------|
| `python manage.py create_access_codes --name "X" --role "Project User"` | Create one access code |
| `python manage.py create_access_codes --csv participants.csv` | Batch create from CSV |
| `python manage.py ai_usage_report` | Print AI usage report (this month) |
| `python manage.py ai_usage_report --days 7 --daily` | Last 7 days, day-by-day |
| `python manage.py ai_usage_report --json` | Full JSON dump |
| `python manage.py migrate` | Apply DB migrations |

---

## API surface (unchanged from original)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/auth/login` | — | `{code}` → session cookie |
| GET | `/api/auth/me` | ✓ | `{id, name, role}` |
| POST | `/api/auth/logout` | — | clears cookie |
| GET | `/api/db/:collection` | ✓ | `{docs: [{id, data}]}` |
| GET | `/api/db/:collection/:id` | ✓ | `{exists, data}` |
| PUT | `/api/db/:collection/:id` | ✓ | upsert document |
| DELETE | `/api/db/:collection/:id` | ✓ | delete document |
| POST | `/api/ai/json` | ✓ | `{prompt, opts}` → parsed JSON |
| POST | `/api/ai/text` | ✓ | `{prompt, opts}` → `{text, truncated}` |
| POST | `/api/uploads/` | ✓ | multipart file upload |
| GET | `/api/uploads/:id` | ✓ | stream file (ownership checked) |
| GET | `/api/admin/ai-usage` | Admin | usage report |
| GET | `/api/admin/access-codes` | Admin | list participants |
| POST | `/api/admin/access-codes` | Admin | create code |
| POST | `/api/admin/access-codes/:id/revoke` | Admin | revoke + kill sessions |
| GET | `/healthz` | — | `{ok: true}` |

---

## Roles

| Role | Can see |
|------|---------|
| **Project User** | Own projects and uploads only |
| **M&E Reviewer** | All projects (institution-wide) |
| **Administrator** | Everything + `/api/admin/*` |

---

## Security notes (same as original)

- Access codes are stored as HMAC-SHA256 digests only — the raw code is
  returned once at creation and never again.
- Rotating `SESSION_SECRET` immediately invalidates all codes and sessions.
- AI calls log **metadata only** (tokens, model, duration) — prompt and
  response text are never logged.
- Uploaded files are never publicly accessible; every download re-checks
  the session cookie and ownership.
- Set `COOKIE_SECURE=True` and serve over HTTPS in every real deployment.
