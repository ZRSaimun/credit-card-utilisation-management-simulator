# Laravel API backend

This is the production backend boundary for the simulator. It stores simulation scenarios only. It has no banking integrations, payment processing, Direct Debit creation, or access to real card accounts.

## Setup

Install PHP 8.2+, Composer, and Laravel 12, then run:

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

API endpoints: `GET /api/health`, `GET /api/scenarios`, `POST /api/scenarios`, `GET /api/scenarios/{id}`, and `DELETE /api/scenarios/{id}`.

