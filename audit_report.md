# Project835 — Production Readiness Audit

> **Audit Date**: 2026-08-22  
> **Status**: READ-ONLY INSPECTION — no files modified

---

## 1. Current Architecture

### Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Backend Framework | Django | ≥ 4.2.0 (unpinned upper bound) |
| Python | CPython | 3.11 (virtualenv `py3.11/` present) |
| Frontend Framework | React + Vite | React 19.2.8, Vite 8.2.0 |
| Database | **SQLite3** | File-based (`db.sqlite3`) |
| Auth | Custom `AbstractBaseUser` + TOTP (pyotp) | Session-based |
| EDI Parsing | Custom parser + pyx12 library | ≥ 4.0.0 |
| SFTP | Paramiko (imported at runtime, **not in requirements.txt**) | Unknown |
| PDF Processing | PyPDF2 / pypdf (imported at runtime, **not in requirements.txt**) | Unknown |
| Encryption | cryptography (Fernet, **not in requirements.txt**) | Unknown |

### Django Apps

| App | Purpose | Models | Views LOC |
|---|---|---|---|
| `accounts` | Users, Clients, Auth, TOTP, Admin APIs | `User`, `Client`, `ClientContact`, `EmployeeRole`, `ClientStepComment` | ~1,176 |
| `admin_panel` | Admin onboarding workflows, SMTP, documents, mappings, audit | `OnboardingStepDefinition`, `ClientStepStatus`, `GoLiveStepDefinition`, `ClientGoLiveStatus`, `OffboardingStepDefinition`, `ClientOffboardingStatus`, `ClientTestEnvironment`, `AuditLog`, `ClientDocument`, `MirMappingField`, `ClientSmtpConfig` | ~2,296 |
| `edi835` | EDI 835 file processing, SFTP config, batch conversion | `EDI835File`, `SFTPConfig` | ~1,405 |
| `converter` | EDI 835 → MIR conversion API | None (uses edi835 models) | ~594 |
| `home` | SPA shell (serves React `index.html`) | None | ~16 |

### Standalone Components

| Directory | Purpose |
|---|---|
| `835_to_mir_app_integrated/` | **Legacy FastAPI app** (separate `requirements.txt` with `fastapi`, `uvicorn`). Not integrated into Django. Appears to be the original standalone EDI converter. |
| `admin_panel/mir_mapper_logic/` | MIR mapping engine (parser, generator, mapping store, defaults) used by admin panel |
| `converter/services/` | Core EDI 835 parser and validator |
| `frontend/` | React 19 + Vite SPA (client portal + admin portal) |
| `scratch/` | Patch scripts (not part of the main app) |
| `sample_docs/` | Template PDFs and sample EDI files for onboarding validation |
| `validation.py` | Root-level validation module used by admin_panel |

### Frontend Architecture

- **React SPA** served from `static/react/index.html` via Vite build
- **Dual portal**: Client portal (`/home/`) and Admin portal (`/administrator`)
- **Dev mode**: Vite dev server on port 3000, proxying API to Django on port 8000
- **Build output**: `frontend/` → `static/react/` (Django serves via `home_view`)
- **No React Router** — manual page switching via state, `window.location` for admin route detection

---

## 2. Current Database Setup

### Engine
**SQLite3** — single file at project root (`db.sqlite3`, 503KB)

### Models (28 total across apps)

**accounts** (5 models):
- `Client` — UUID PK, client organizations, custom `db_table='client'`
- `User` — Custom user model (`AUTH_USER_MODEL`), email-based login, TOTP fields, FK to Client
- `ClientContact` — UUID PK, contact persons per client, `db_table='client_contact'`
- `EmployeeRole` — Role definitions, `db_table='employee_role'`
- `ClientStepComment` — UUID PK, onboarding step comments, `db_table='client_step_comment'`

**admin_panel** (11 models):
- `OnboardingStepDefinition` — 14-step onboarding workflow template
- `ClientStepStatus` — Per-client onboarding step progress
- `GoLiveStepDefinition` — Go-live workflow template
- `ClientGoLiveStatus` — Per-client go-live step progress
- `OffboardingStepDefinition` — Offboarding workflow template
- `ClientOffboardingStatus` — Per-client offboarding step progress
- `ClientTestEnvironment` — Test SFTP environment per client
- `AuditLog` — System-wide audit trail
- `ClientDocument` — File uploads stored via Django `FileField` (`media/documents/`)
- `MirMappingField` — Per-client MIR field mapping configuration
- `ClientSmtpConfig` — Per-client SMTP email config with encrypted passwords, `db_table='client_smtp_config'`

**edi835** (2 models):
- `EDI835File` — Processed EDI files, `db_table='835file'`
- `SFTPConfig` — SFTP connection details, `db_table='sftp_config'`

### Migrations
- `accounts`: 9 migrations (0001–0009)
- `admin_panel`: 5 migrations (0001–0005)
- `edi835`: 9 migrations (0001–0009)

### SQLite-Specific Concerns
- No `SELECT ... FOR UPDATE` or row locking (SQLite doesn't support it)
- JSONField used for `recovery_codes` — works on SQLite but behavior differs from PostgreSQL
- No explicit database constraints beyond Django ORM defaults
- `db.sqlite3` is 503KB — small enough for direct migration

---

## 3. Current Authentication Setup

### User Model
- Custom `User` model extending `AbstractBaseUser` + `PermissionsMixin`
- Email-based login (`USERNAME_FIELD = "email"`)
- Required fields: `name`, `mobile` (unique)
- FK to `Client` (nullable, for client users)
- TOTP fields: `totp_secret`, `totp_enabled`, `recovery_codes` (JSONField)
- `first_login` flag for forced password change

### Authentication Flow
1. **Login** → Django session auth (`django.contrib.auth.login`)
2. **TOTP Setup** → If `totp_enabled=False`, forced TOTP enrollment (QR code via pyotp + qrcode)
3. **TOTP Verify** → On every login, session flag `totp_verified` must be True
4. **First Login** → Password change forced when `first_login=True`

### Session Security
- `SESSION_COOKIE_HTTPONLY = True`
- `SESSION_COOKIE_SAMESITE = "Lax"`
- `CSRF_COOKIE_SAMESITE = "Lax"`

### API Authentication
- **All API endpoints use `@csrf_exempt`** ← ⚠️ CRITICAL SECURITY ISSUE
- Some endpoints check `request.user.is_authenticated` manually
- Admin APIs in `admin_panel/` protected by `AdminAccessMiddleware` (path-based)
- No token-based auth (JWT, DRF tokens, etc.)
- No rate limiting on login/signup endpoints

### Authorization
- **Role-based**: `is_superuser` (Super Admin), `is_staff` (Admin), regular User
- `AdminAccessMiddleware` blocks non-staff from `/admin-panel/`, `/administrator`, `/mapping`
- Offboarded client users blocked at middleware level
- Super Admin permission checks on user creation/update/delete

---

## 4. Current Deployment Setup

### Current State: **Development-only**

There is **no production deployment configuration whatsoever**:

- No `Dockerfile` or `docker-compose.yml`
- No `Procfile` (Heroku)
- No Gunicorn/uWSGI configuration
- No Nginx/Apache configuration
- No CI/CD pipeline
- No `.env` file or environment variable loading
- No `STATIC_ROOT` setting
- No `collectstatic` setup
- No WhiteNoise or CDN for static files
- No production WSGI/ASGI server config
- No health check endpoint
- No `LOGGING` configuration
- No error monitoring (Sentry, etc.)

### How It Currently Runs
```
python manage.py runserver    # Django dev server on :8000
cd frontend && npm run dev    # Vite dev server on :3000 (proxies API to :8000)
```

---

## 5. Problems Preventing Production Readiness

### 🔴 CRITICAL (Must Fix)

| # | Issue | Location | Detail |
|---|---|---|---|
| C1 | **Hardcoded SECRET_KEY** | [settings.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/project835/settings.py#L10) | `"django-insecure-project835-combined-key-change-in-production"` — labeled insecure |
| C2 | **Hardcoded encryption key** | [settings.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/project835/settings.py#L27) | `SMTP_FIELD_ENCRYPTION_KEY` is a Fernet key hardcoded in source code |
| C3 | **DEBUG = True** | [settings.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/project835/settings.py#L12) | Stack traces exposed, debug toolbar, etc. |
| C4 | **ALLOWED_HOSTS = ["*"]** | [settings.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/project835/settings.py#L14-L18) | Accepts any Host header — HTTP Host header attacks |
| C5 | **`@csrf_exempt` on ALL API views** | All 4 view files | 30+ endpoints with CSRF disabled — session hijacking vulnerability |
| C6 | **Hardcoded default password** | [accounts/views.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/accounts/views.py#L762), [L972](file:///c:/Users/ammar/Desktop/project%20mir/Project835/accounts/views.py#L972), [admin_panel/views.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/admin_panel/views.py#L509) | `"Password@123"` used as default when no password provided |
| C7 | **SQLite in production** | [settings.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/project835/settings.py#L108-L113) | No concurrent write support, no backup strategy, not suitable for multi-user web app |
| C8 | **No environment variable loading** | [settings.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/project835/settings.py) | All configuration hardcoded — no `os.environ`, no `python-decouple`, no `.env` |
| C9 | **SFTP/SSH credentials stored in plain text** | [edi835/models.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/edi835/models.py#L139-L151) | `password`, `outbound_password`, `ssh_key` stored unencrypted in DB |
| C10 | **TOTP secrets stored in plain text** | [accounts/models.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/accounts/models.py#L84) | `totp_secret` stored as plain CharField — should be encrypted at rest |
| C11 | **No HTTPS enforcement** | [settings.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/project835/settings.py) | Missing `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` |

### 🟠 HIGH (Should Fix)

| # | Issue | Location | Detail |
|---|---|---|---|
| H1 | **No STATIC_ROOT** | [settings.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/project835/settings.py#L157-L160) | `collectstatic` will fail — no static file serving in production |
| H2 | **Media files only served in DEBUG** | [urls.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/project835/urls.py#L38-L39) | `if settings.DEBUG:` guard means no media serving in production |
| H3 | **Missing dependencies in requirements.txt** | [requirements.txt](file:///c:/Users/ammar/Desktop/project%20mir/Project835/requirements.txt) | Missing: `paramiko`, `cryptography`, `PyPDF2`/`pypdf`, `gunicorn`, `psycopg2`, `python-decouple` |
| H4 | **Unpinned dependency versions** | [requirements.txt](file:///c:/Users/ammar/Desktop/project%20mir/Project835/requirements.txt) | Only minimum versions specified (`>=`) — no upper bounds for reproducibility |
| H5 | **No LOGGING configuration** | [settings.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/project835/settings.py) | No structured logging, no file/stream handler, no error reporting |
| H6 | **Duplicate API endpoints** | [accounts/views.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/accounts/views.py) vs [admin_panel/views.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/admin_panel/views.py) | `api_admin_stats`, `api_admin_users`, `api_admin_create_user`, `api_admin_update_user`, `api_admin_delete_user` all duplicated across both files |
| H7 | **No admin API authentication check** | Multiple admin APIs | Several admin APIs in `accounts/views.py` don't check `is_staff`/`is_superuser` — rely solely on middleware path matching |
| H8 | **Dead code** | [accounts/views.py L871](file:///c:/Users/ammar/Desktop/project%20mir/Project835/accounts/views.py#L871) | Unreachable code after `return` in `api_admin_delete_user` |
| H9 | **cookie.txt in repository** | [cookie.txt](file:///c:/Users/ammar/Desktop/project%20mir/Project835/cookie.txt) | Netscape cookie file committed to git (empty but shouldn't exist) |
| H10 | **No rate limiting** | All auth endpoints | Login, signup, TOTP verify — no brute force protection |
| H11 | **Recovery codes stored in plain JSON** | [accounts/models.py L90](file:///c:/Users/ammar/Desktop/project%20mir/Project835/accounts/models.py#L90) | `recovery_codes = JSONField` — visible in DB, not hashed |
| H12 | **`OneSmarter` hardcoded in source** | Multiple view files | Company name hardcoded as string literals throughout Python and React code |

### 🟡 MEDIUM (Recommended)

| # | Issue | Location | Detail |
|---|---|---|---|
| M1 | **No CORS configuration** | settings.py | No `django-cors-headers` — will fail when frontend is on a different domain |
| M2 | **No database connection pooling** | settings.py | When switching to PostgreSQL, should use `django-db-connection-pool` or pgBouncer |
| M3 | **File uploads go to local disk** | [admin_panel/models.py L132](file:///c:/Users/ammar/Desktop/project%20mir/Project835/admin_panel/models.py#L132) | `FileField(upload_to='documents/')` — need S3/cloud storage for production |
| M4 | **EDI files stored on local filesystem** | [edi835/services.py](file:///c:/Users/ammar/Desktop/project%20mir/Project835/edi835/services.py#L14-L33) | `media/edi835/{input,processing,output,archive,error}` — ephemeral in containers |
| M5 | **No health check endpoint** | N/A | No `/healthz` or `/ready` for load balancers |
| M6 | **3-second polling interval** | [frontend/src/App.jsx L115](file:///c:/Users/ammar/Desktop/project%20mir/Project835/frontend/src/App.jsx#L115) | `setInterval(refreshDashboardData, 3000)` — aggressive for production |
| M7 | **No pagination on list endpoints** | accounts/views.py, admin_panel/views.py | All list APIs return full datasets — will degrade with scale |
| M8 | **Legacy FastAPI app** | `835_to_mir_app_integrated/` | Unused code that should be cleaned up or explicitly excluded |
| M9 | **`__pycache__` and `.venv` in repo** | Various | `.gitignore` covers some but `__pycache__/` dirs exist in repo |
| M10 | **No input validation for file sizes** | edi835/views.py, admin_panel/views.py | No `FILE_UPLOAD_MAX_MEMORY_SIZE` or `DATA_UPLOAD_MAX_MEMORY_SIZE` limits |

---

## 6. Recommended Order of Changes

### Phase 1: Environment & Secrets (Do First)
1. Create `.env` file and `python-decouple` / `os.environ` loading
2. Externalize `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `SMTP_FIELD_ENCRYPTION_KEY`
3. Externalize database configuration (PostgreSQL connection string)
4. Add `.env` to `.gitignore`

### Phase 2: Database
5. Install and configure PostgreSQL (`psycopg2-binary`)
6. Split settings into `base.py`, `development.py`, `production.py`
7. Test migrations against PostgreSQL
8. Create data migration script for existing SQLite data

### Phase 3: Security Hardening
9. Remove all `@csrf_exempt` decorators — implement proper CSRF token handling in React
10. Add production security settings (`SECURE_SSL_REDIRECT`, `SECURE_HSTS_*`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`)
11. Remove hardcoded `Password@123` default — require explicit passwords
12. Encrypt SFTP credentials and TOTP secrets at rest
13. Add rate limiting (`django-ratelimit` or middleware)
14. Add CORS configuration (`django-cors-headers`)

### Phase 4: Static & Media Files
15. Configure `STATIC_ROOT` and `collectstatic`
16. Add WhiteNoise for static file serving
17. Configure cloud storage for media files (S3 or equivalent)
18. Remove `if settings.DEBUG:` guard on media URL serving (use proper storage backend)

### Phase 5: Dependencies & Requirements
19. Pin all dependency versions in `requirements.txt`
20. Add missing dependencies (`paramiko`, `cryptography`, `PyPDF2`, `gunicorn`, `psycopg2-binary`, etc.)
21. Create separate `requirements-dev.txt` for development-only dependencies

### Phase 6: Deployment Infrastructure
22. Create production `wsgi.py` / `gunicorn.conf.py`
23. Create `Dockerfile` and `docker-compose.yml`
24. Configure `LOGGING` with structured output
25. Add health check endpoint
26. Create `Procfile` (if deploying to PaaS)

### Phase 7: Code Quality
27. Deduplicate admin APIs (remove duplicates from `accounts/views.py`)
28. Remove dead code, `cookie.txt`, scratch files
29. Add API pagination
30. Clean up legacy `835_to_mir_app_integrated/` directory

---

## 7. Files That Will Need Modification

| File | Changes Needed |
|---|---|
| [`project835/settings.py`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/project835/settings.py) | Split into `base.py`/`development.py`/`production.py`, externalize all secrets, add PostgreSQL, STATIC_ROOT, LOGGING, security settings |
| [`requirements.txt`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/requirements.txt) | Pin versions, add missing deps (paramiko, cryptography, gunicorn, psycopg2-binary, whitenoise, django-cors-headers, python-decouple) |
| [`accounts/views.py`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/accounts/views.py) | Remove `@csrf_exempt`, remove duplicate admin APIs, remove hardcoded password default, add auth checks |
| [`admin_panel/views.py`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/admin_panel/views.py) | Remove `@csrf_exempt`, remove hardcoded password default, add auth checks |
| [`edi835/views.py`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/edi835/views.py) | Remove `@csrf_exempt`, add auth checks |
| [`converter/views.py`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/converter/views.py) | Remove `@csrf_exempt`, add auth checks |
| [`project835/urls.py`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/project835/urls.py) | Remove `if settings.DEBUG:` media guard, add health check URL |
| [`project835/middleware.py`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/project835/middleware.py) | Minor — ensure all admin paths are properly guarded |
| [`manage.py`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/manage.py) | Update settings module reference if splitting settings |
| [`project835/wsgi.py`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/project835/wsgi.py) | Update settings module reference |
| [`project835/asgi.py`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/project835/asgi.py) | Update settings module reference |
| [`.gitignore`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/.gitignore) | Add `.env`, `__pycache__/`, `staticfiles/`, `cookie.txt` |
| [`frontend/vite.config.js`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/frontend/vite.config.js) | Proxy URL may need updating for production API base |
| [`frontend/src/App.jsx`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/frontend/src/App.jsx) | CSRF token handling in fetch calls, reduce polling interval |
| [`frontend/src/utils/api.js`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/frontend/src/utils/api.js) | Add CSRF token header to all requests |
| [`edi835/models.py`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/edi835/models.py) | Encrypt SFTP credential fields |
| [`accounts/models.py`](file:///c:/Users/ammar/Desktop/project%20mir/Project835/accounts/models.py) | Encrypt TOTP secret field |

---

## 8. Files That Should Be Created

| File | Purpose |
|---|---|
| `.env` | Environment variables (SECRET_KEY, DATABASE_URL, SMTP_FIELD_ENCRYPTION_KEY, DEBUG, ALLOWED_HOSTS) |
| `.env.example` | Template `.env` with placeholder values (committed to git) |
| `project835/settings/base.py` | Shared settings (when splitting settings module) |
| `project835/settings/development.py` | Dev-specific settings (DEBUG=True, SQLite) |
| `project835/settings/production.py` | Production settings (DEBUG=False, PostgreSQL, security headers) |
| `project835/settings/__init__.py` | Settings package init |
| `Dockerfile` | Container image definition |
| `docker-compose.yml` | Multi-service orchestration (Django + PostgreSQL + Redis) |
| `.dockerignore` | Files excluded from Docker build context |
| `gunicorn.conf.py` | Gunicorn WSGI server configuration |
| `Procfile` | PaaS deployment process definition (if applicable) |
| `requirements-dev.txt` | Development-only dependencies |
| `staticfiles/` (directory) | Target for `collectstatic` output |
| `scripts/migrate_data.py` | SQLite → PostgreSQL data migration script |

---

> **⚠️ IMPORTANT**: No files have been modified, deleted, renamed, refactored, or created as part of this audit.  
> Awaiting your instruction before making any changes.
