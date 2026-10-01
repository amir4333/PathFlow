# PathFlow Phase 5: PHP / MySQL Production Deployment Runbook

This runbook documents the deployment, configuration, and verification procedures for running PathFlow in realistic shared hosting (cPanel, Apache, LiteSpeed) and dedicated VPS environments.

---

## 1. Environment Compatibility Summary

| Component | Target Requirement | PathFlow Compatibility | Verification Method |
|---|---|---|---|
| **PHP Runtime** | PHP 8.2+ | Native strict types, null-safe operators, no deprecated functions | Verified via `php -v` (PHP 8.2.33) & `run-tests.php` |
| **PHP Extensions** | `pdo`, `pdo_mysql`, `json`, `mbstring`, `openssl` | Standard extensions available on all shared hosting providers | Verified in test suite |
| **MySQL / MariaDB** | MySQL 8.0+ or MariaDB 10.4+ | InnoDB, `utf8mb4`, `utf8mb4_unicode_ci`, full foreign keys & cascading constraints | Verified via `schema.sql` and `init.php` |
| **Web Server** | Apache 2.4+ / LiteSpeed / Nginx | URL rewriting via `mod_rewrite`, header pass-through | Verified via `.htaccess` security rules |
| **Dependency Model** | Zero Composer requirement | Zero third-party Composer packages; custom PSR-4 autoloader | Self-contained in `src/Support/Autoloader.php` |

---

## 2. Shared Hosting / cPanel Deployment Architectures

### Architecture A: Single Domain with Subdirectory Webroot (Recommended)
* **Frontend Webroot**: `public_html/` contains the compiled SPA (`dist/` contents from `npm run build`).
* **Backend Source**: Uploaded to `/home/username/pathflow-backend` (above `public_html` for maximum security).
* **API Entrypoint**: Symlink or alias `public_html/api` -> `/home/username/pathflow-backend/public`.
* **Frontend URL**: `https://yourdomain.com`
* **API URL**: `https://yourdomain.com/api`

### Architecture B: Subdomain Architecture
* **Frontend Domain**: `https://app.yourdomain.com` pointing to `public_html/app`
* **Backend Domain**: `https://api.yourdomain.com` pointing directly to `/home/username/pathflow-backend/public`

### Architecture C: Standalone Shared Hosting / Subfolder
* If all files must reside inside `public_html/`:
  * Upload `backend/` to `public_html/api/`
  * The protective `.htaccess` files in `backend/` and `backend/public/` strictly deny direct access to `.env`, `schema.sql`, `src/`, and `database/`.

---

## 3. Database Deployment Procedure

1. **Create MySQL Database in cPanel**:
   * Navigate to **cPanel > MySQL® Databases**.
   * Create a new database: e.g. `user_pathflow`.
   * Create a database user with a strong, random password.
   * Add the user to the database with `ALL PRIVILEGES`.

2. **Initialize Database Schema**:
   * **Option 1 (Command Line / SSH or Terminal in cPanel)**:
     ```bash
     php backend/database/init.php
     ```
   * **Option 2 (phpMyAdmin)**:
     * In cPanel, open **phpMyAdmin**.
     * Select `user_pathflow`.
     * Click **Import** > Select `backend/database/schema.sql` > Click **Go**.

3. **Verify Database Invariants**:
   * Run the verification check:
     ```bash
     php backend/database/verify.php
     ```
   * Expected: All 10 tables (`User`, `Goal`, `Roadmap`, `Task`, `Session`, `WeeklyPlan`, `WeeklyPlanItem`, `SyncMutationRecord`, `Tombstone`, `TeacherAccessGrant`) confirmed.

---

## 4. Production Environment Configuration

Create or update `.env` in the backend directory (or root `.env`):

```ini
# Database Connection
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=user_pathflow
DB_USERNAME=user_dbuser
DB_PASSWORD=strong_production_password_here
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci

# In cPanel if connecting via Unix socket (optional):
# DB_SOCKET=/var/lib/mysql/mysql.sock

# Authentication Secret (Used for HMAC-SHA256 JWT tokens)
# Generate using: openssl rand -base64 32
AUTH_SECRET=a_cryptographically_secure_random_string_32_characters_minimum

# Environment
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.yourdomain.com

# CORS Configuration
# Set to your exact frontend origin(s)
CORS_ORIGIN=https://app.yourdomain.com
# Alias also supported:
# CORS_ALLOWED_ORIGINS=https://app.yourdomain.com
```

### Critical Security Invariants:
* **Never commit `.env` to Git**. Both `.gitignore` and `backend/.gitignore` exclude `.env` files.
* **Keep `APP_DEBUG=false` in production** to prevent internal file paths or SQL details from leaking in JSON error responses.

---

## 5. Apache & FastCGI Header Workaround

In shared hosting environments using Apache with PHP-FPM or FastCGI, HTTP authorization headers may be stripped before reaching PHP.

The provided `backend/public/.htaccess` and `backend/src/Http/Request.php` automatically handle this:
1. `.htaccess` captures headers:
   ```apache
   RewriteCond %{HTTP:Authorization} .
   RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

   RewriteCond %{HTTP:X-Teacher-Token} .
   RewriteRule .* - [E=HTTP_X_TEACHER_TOKEN:%{HTTP:X-Teacher-Token}]
   ```
2. `Request::createFromGlobals()` transparently falls back to `REDIRECT_HTTP_AUTHORIZATION`, `REDIRECT_HTTP_X_TEACHER_TOKEN`, and `apache_request_headers()`.

---

## 6. Frontend Production Build & Deployment

1. **Configure Environment for Frontend Build**:
   ```bash
   # Set production API base URL
   export VITE_API_BASE_URL="https://api.yourdomain.com"
   ```

2. **Execute Build**:
   ```bash
   npm run build
   ```
   Output will be generated in `dist/`.

3. **Deploy Frontend Assets**:
   * Upload all contents of `dist/` to your frontend document root (`public_html` or subdomain folder).
   * Ensure SPA rewrite rule is present in frontend `.htaccess` (if hosted under Apache):
     ```apache
     <IfModule mod_rewrite.c>
       RewriteEngine On
       RewriteBase /
       RewriteRule ^index\.html$ - [L]
       RewriteCond %{REQUEST_FILENAME} !-f
       RewriteCond %{REQUEST_FILENAME} !-d
       RewriteRule . /index.html [L]
     </IfModule>
     ```

---

## 7. Verification Checklist

1. **Health Check**:
   ```bash
   curl -i https://api.yourdomain.com/api/health
   ```
   * Expected: `HTTP 200 OK`, `{"status":"ok","timestamp":"..."}`

2. **Authentication Check**:
   * Register a new user via `POST /api/auth/register`
   * Log in via `POST /api/auth/login`
   * Confirm token resolution via `GET /api/auth/me` with `Authorization: Bearer <token>`

3. **Synchronization Check**:
   * Execute sync delta push via `POST /api/sync/push`
   * Query status via `GET /api/sync/status`
   * Confirm monotonic delta sequence and tombstone persistence on delete

4. **Teacher Access Check**:
   * Student creates grant via `POST /api/teacher/grants`
   * Read-only teacher inspects student goals via `GET /api/teacher/students/:studentId/goals`
   * Verify that any POST, PUT, PATCH, or DELETE mutation attempts return `HTTP 403 Forbidden`.
