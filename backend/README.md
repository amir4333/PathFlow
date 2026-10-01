# PathFlow PHP / MySQL Backend

This directory contains the production-ready PHP/MySQL backend implementation for PathFlow, engineered for deployment on standard shared hosting environments (cPanel, Apache, Nginx, LiteSpeed) and dedicated VPS environments.

It implements the identical REST API, synchronization contracts, and teacher-access boundaries as the Fastify/PostgreSQL reference backend.

---

## 1. System Requirements

* **PHP**: PHP 8.2 or newer
  * Extensions: `pdo`, `pdo_mysql`, `json`, `mbstring`
* **Database**: MySQL 8.0+ or MariaDB 10.4+
  * Storage Engine: `InnoDB`
  * Charset: `utf8mb4`
  * Collation: `utf8mb4_unicode_ci`
* **Web Server**: Apache with `mod_rewrite`, LiteSpeed, or Nginx with URL rewriting.

---

## 2. Directory Structure

```text
backend/
├── public/
│   ├── index.php         # Front controller & request dispatcher
│   └── .htaccess         # Apache URL rewrite and authorization header pass-through
├── src/
│   ├── Config/
│   │   └── Config.php    # Lightweight environment (.env) loader
│   ├── Database/
│   │   └── Database.php  # PDO MySQL wrapper with native prepared statements & transactions
│   ├── Http/
│   │   ├── Request.php   # HTTP request representation, headers, and JSON body parser
│   │   ├── Response.php  # JSON response serializer matching { "error": "..." } contracts
│   │   └── Cors.php      # Cross-Origin Resource Sharing handler for web & desktop clients
│   ├── Router/
│   │   └── Router.php    # Lightweight REST router with route parameter matching (:studentId)
│   └── Support/
│       └── Autoloader.php# Zero-dependency PSR-4 autoloader
├── database/
│   ├── schema.sql        # Full 10-table MySQL production schema with InnoDB, FKs, and indexes
│   └── verify.php        # Non-destructive schema and connection verification script
├── tests/
│   └── run-tests.php     # PHP unit & integration test runner for configuration, router, and HTTP
├── .env.example          # Environment variable template
└── README.md             # This guide
```

---

## 3. Local Setup & Configuration

1. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Configure your MySQL credentials and a secure `AUTH_SECRET`:
   ```ini
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=pathflow_db
   DB_USERNAME=your_db_user
   DB_PASSWORD=your_db_password
   AUTH_SECRET=your_super_secret_key_min_32_characters
   CORS_ORIGIN=http://localhost:3000
   ```

2. **Create MySQL Database & Import Schema**:
   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS pathflow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   # You can initialize the database using the safe PHP initializer:
   php backend/database/init.php
   # Or directly via MySQL CLI:
   mysql -u root -p pathflow_db < backend/database/schema.sql
   ```

3. **Verify Database Structure**:
   ```bash
   php backend/database/verify.php
   ```

---

## 4. Running the Health Check

You can run the built-in PHP development server pointing to `backend/public`:

```bash
php -S 127.0.0.1:3001 -t backend/public
```

Then query the health check endpoint:
```bash
curl -i http://127.0.0.1:3001/api/health
```

Expected Response (`HTTP 200 OK`):
```json
{
  "status": "ok",
  "timestamp": "2026-09-28T16:15:00.000Z"
}
```

---

## 5. Running Backend Automated Tests

To execute the unit and integration tests for Configuration, Router, Request/Response, CORS, and Health Check:

```bash
php backend/tests/run-tests.php
```

---

## 6. Shared Hosting & cPanel Deployment Assumptions

1. **Document Root**:
   * Set your domain or subdomain's Document Root to `backend/public/`.
   * If your hosting only allows placing files in `public_html/`, place the contents of `backend/public/` in `public_html/` and the `src/`, `database/`, and `.env` directories outside the webroot (e.g. `../backend_app/`).
2. **Apache `.htaccess`**:
   * The provided `backend/public/.htaccess` automatically routes `/api/*` to `index.php` and passes through `Authorization` and `X-Teacher-Token` headers.
3. **Zero Composer Dependency**:
   * All classes are dynamically loaded via the built-in `Autoloader.php`. No `composer install` command is required on the shared hosting server.
