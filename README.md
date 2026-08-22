# Project835

Project835 is a secure, production-grade Django web application designed to parse, validate, and convert medical EDI 835 transaction files into the MIR format, handle multi-tenant user authentication, restrict administrative access with session and TOTP restrictions, and automate outbound delivery.

---

## Architecture Overview

The system follows a modular Django MVC/MVT architecture, combining custom middleware security layers with specialized background file processor services:

* **Presentation Layer**: Serves dynamic Django views alongside prebuilt single-page React frontend bundles (served securely via **WhiteNoise** in production).
* **Access & Security Layer**: Employs custom middlewares (`AdminAccessMiddleware` & `ClientAccessMiddleware`) to enforce role-based access control, route protection, and mandatory TOTP/MFA validation.
* **Business & Service Layer**: Custom service utilities (`converter` & `edi835` modules) validate files using the `PyX12` engine and translate claims records into formatted MIR layouts.
* **Storage & Infrastructure Layer**: Employs a secure database abstraction (`dj-database-url`) supporting instant database cutover (e.g. to **PostgreSQL**) and outbound sync connectivity via SFTP handlers.

---

## Folder Structure

```text
Project835/
├── accounts/          # User authentication, profiles, client onboarding & TOTP configurations
├── admin_panel/       # Administrative dashboard APIs, MIR field mapping registries & audit logs
├── converter/         # Core EDI 835 parsing engines, validation controllers & API endpoints
├── edi835/            # Tracked file models, SFTP configurations & localized file observer daemons
├── home/              # User landing page layouts and navigation components
├── media/             # Localized secure directory structure for file transitions (input, processing, archive, error)
├── project835/        # Main Django project settings, middlewares, and main URL routes
├── templates/         # Shared HTML template layout skeletons
├── static/            # Local static source assets (custom CSS & JavaScript dependencies)
├── staticfiles/       # Target build folder populated by the collectstatic utility in production
├── requirements.txt   # Pinpoint production package list
└── manage.py          # Command line administrative entry point
```

---

## Requirements
* **Python**: 3.11 or later
* **Database**: PostgreSQL 15 or later (SQLite is supported for local development only)
* **Outbound Storage**: SFTP/FTP server (Optional, for outbound MIR exports)

---

## Local Setup

### 1. Initialize Virtual Environment
Initialize a clean Python virtual environment:
```bash
python -m venv venv
```

Activate the environment:
* **Windows (PowerShell)**:
  ```powershell
  .\venv\Scripts\Activate.ps1
  ```
* **Linux / macOS**:
  ```bash
  source venv/bin/activate
  ```

### 2. Install Dependencies
Install all required packages from `requirements.txt`:
```bash
pip install -r requirements.txt
```

### 3. Environment Configuration
Create a `.env` file in the root directory by copying the example:
* **Windows (PowerShell)**:
  ```powershell
  Copy-Item .env.example .env
  ```
* **Linux / macOS**:
  ```bash
  cp .env.example .env
  ```
Configure the settings inside `.env`:
* Ensure `DEBUG=True` for local development.
* Generate a random 50-character string for `SECRET_KEY`.
* Set your `DATABASE_URL` (e.g. `postgres://username:password@localhost:5432/project835` for PostgreSQL, or leave it as `sqlite:///db.sqlite3` for local testing).

### 4. Run Migrations & Server
```bash
# Apply database migrations
python manage.py migrate

# Create administrative superuser account
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

---

## PostgreSQL Setup

### 1. Create the Database & User
Log in to your PostgreSQL CLI tool (`psql`) as superuser and execute:
```sql
CREATE DATABASE project835;
CREATE USER project835_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE project835 TO project835_user;
ALTER DATABASE project835 OWNER TO project835_user;
```

### 2. Configure Environment Connection
Update your local `.env` file to use the PostgreSQL database string:
```text
DATABASE_URL=postgres://project835_user:secure_password@localhost:5432/project835
```

### 3. Run Migrations
Apply all schema changes to the newly configured PostgreSQL instance:
```bash
python manage.py migrate
```

---

## SQLite → PostgreSQL Migration

To migrate existing application data from an SQLite database (`db.sqlite3`) to PostgreSQL:

1. **Dump existing SQLite database data** to a JSON fixture file (excluding django system-generated tables like contenttypes and permissions to avoid constraint violations):
   ```bash
   python manage.py dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.Permission --indent 4 > datadump.json
   ```
2. **Switch connection target to PostgreSQL** by updating the `DATABASE_URL` env variable in your `.env` file.
3. **Execute migrations** on the empty PostgreSQL database:
   ```bash
   python manage.py migrate
   ```
4. **Load the dumped data fixture** into PostgreSQL:
   ```bash
   python manage.py loaddata datadump.json
   ```

---

## Production Deployment

### 1. Environment Variables
In production, ensure the following environment variables are supplied:
* `DEBUG=False`
* `SECRET_KEY` (Strong, cryptographically secure 50+ character key)
* `ALLOWED_HOSTS` (Comma-separated hostnames/IP addresses, e.g. `app.project835.com`)
* `CSRF_TRUSTED_ORIGINS` (Comma-separated HTTPS origins, e.g. `https://app.project835.com`)
* `DATABASE_URL` (Target production PostgreSQL connection string)
* `SMTP_FIELD_ENCRYPTION_KEY` (Secret key used for secure storage of credentials at rest)

### 2. Deployment Build Steps
Run these command steps during your CI/CD deployment pipeline:
```bash
# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Collect static assets
python manage.py collectstatic --noinput
```

### 3. WSGI Server & Reverse Proxy
* **WSGI Application**: Run the server using **Gunicorn**:
  ```bash
  gunicorn project835.wsgi:application --bind 0.0.0.0:8000 --workers 4
  ```
* **Reverse Proxy**: Place Gunicorn behind an Nginx or Apache reverse proxy to route traffic, handle SSL termination, and enforce HTTPS rules.
* **Static Assets**: Handled automatically in Django via **WhiteNoise** middleware to serve compressed and cached assets efficiently.
* **Media Assets**: Production media files should be uploaded to a secure object storage service (like AWS S3) if deploying to ephemeral/container environments.
* **Logs**: Django is preconfigured to write runtime diagnostic logs to `logs/project835.log` (if the directory exists) or `project835.log` with automatic file rotation.

---

## Backup and Restore

### Backup PostgreSQL Database
Create a compressed database backup file:
```bash
pg_dump -h localhost -U project835_user -F c -b -v -f project835_backup.dump project835
```

### Restore Database Backup
Restore the database from a backup file:
```bash
pg_restore -h localhost -U project835_user -d project835 -v project835_backup.dump
```

---

## Testing & Verification
Ensure application stability and deployment readiness by running these commands:
```bash
# Sanity check settings & configuration
python manage.py check

# Run production deployment security checks
python manage.py check --deploy

# Check for ungenerated model schema changes
python manage.py makemigrations --check

# Execute unit and integration tests
python manage.py test
```
