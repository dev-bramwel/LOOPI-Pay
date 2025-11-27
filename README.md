# LOOPI++

A small vendor-facing payment dashboard and QR-driven checkout demo built with Django (backend) and React + Vite (frontend). It includes Paystack-oriented checkout flow scaffolding, webhook audit/admin tooling, and a vendor dashboard with a smoothed, interactive transaction line chart.

## Overview

- Backend: Django + Django REST Framework. Handles payment session lifecycle, webhooks, webhook auditing and replay, and vendor APIs.
- Frontend: React (hooks) + Vite. Vendor dashboard, QR generation and scanning UI, admin pages, and an interactive SVG LineChart component that supports smoothing, zoom/pan, timeframe selection and pinned glass-card placement on the dashboard.

## Key Features

- QR-driven checkout flow (generate a session QR, open as customer).
- Polling status and automatic session auto-cancel after expiry.
- Staff-only webhook audit endpoints and a small admin UI to inspect and reprocess webhooks.
- Interactive LineChart component:
  - Timeframes: hours, days, weeks, months, years
  - Smooth curve (Catmull–Rom converted to Bezier), area fill and stroke-draw animation
  - Invisible hit targets with selection marker and tooltip
  - Shift+wheel for vertical zoom and horizontal pan/zoom
  - Default dashboard view set to hourly timeframe and pinned glass-card on top of dashboard

## Quickstart (Windows / PowerShell)

Prerequisites:

- Python 3.8+ and virtualenv
- Node.js 16+ and npm/yarn
- (Optional) Postgres or use default sqlite for development

1. Backend

Open a PowerShell terminal and run:

```powershell
cd 'C:\Users\Bramwel\OneDrive\Desktop\LOOPI++\backend'
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

2. Frontend

In a separate terminal run:

```powershell
cd 'C:\Users\Bramwel\OneDrive\Desktop\LOOPI++\frontend'
# if using npm
npm install
npm run dev
# or with yarn
# yarn
# yarn dev
```

Open the frontend dev server address printed by Vite (e.g. http://localhost:5173/) and sign in as a vendor to view the dashboard. The vendor dashboard shows a pinned LineChart at top of the dashboard view.

## Environment Variables

- Frontend: `VITE_API_URL`, `VITE_FRONTEND_URL` (optional) — set in `.env` files or your shell when running Vite.
- Backend: standard Django environment variables (e.g. `DJANGO_SETTINGS_MODULE`, database config, secret key) — see `backend/.env.example` if present.

### Email / SMTP configuration (local)

To send emails (password resets, notifications) from the backend you can configure SMTP credentials. For local development you have two common options:

- Use a real SMTP provider (SendGrid, Mailgun, Gmail SMTP) and set environment variables.
- Use Django's console backend to print emails to the terminal (safer for local testing).

Recommended environment variables (set in PowerShell or your `.env` file):

```powershell
$Env:EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
$Env:EMAIL_HOST = 'smtp.sendgrid.net'      # or smtp.gmail.com, smtp.mailgun.org
$Env:EMAIL_PORT = '587'
$Env:EMAIL_USE_TLS = 'True'               # or False depending on provider
$Env:EMAIL_HOST_USER = 'your-smtp-user'
$Env:EMAIL_HOST_PASSWORD = 'your-smtp-password'
$Env:DEFAULT_FROM_EMAIL = 'no-reply@yourdomain.com'
```

If you prefer to see emails in the console instead of sending them, use:

```powershell
$Env:EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
```

Notes:

- If you use Gmail, you may need to create an App Password or enable “less secure apps” (not recommended). Prefer a transactional email provider for reliability.
- Put these variables in `backend/.env` (git-ignored) and load them in `settings.py` via `python-dotenv` or `django-environ`.

### Expose local backend with ngrok (webhooks)

To receive webhooks from external services (Paystack, Stripe, etc.) while developing locally, expose your local Django server using `ngrok` and register the forwarded URL with the provider.

Steps (PowerShell):

1. Download and install ngrok: https://ngrok.com/download — unzip and place `ngrok.exe` somewhere on your PATH, or use Chocolatey: `choco install ngrok`.

2. Authenticate ngrok with your account (one-time):

```powershell
.
ngrok.exe authtoken YOUR_NGROK_AUTHTOKEN
```

3. Start your Django dev server (default port 8000):

```powershell
cd 'C:\Users\Bramwel\OneDrive\Desktop\LOOPI++\backend'
.\.venv\Scripts\Activate.ps1
python manage.py runserver 0.0.0.0:8000
```

4. Run ngrok to forward HTTP(S) to your local port:

```powershell
.
ngrok.exe http 8000
```

5. Copy the HTTPS forwarding URL shown by ngrok (e.g. `https://abcd-1234.ngrok.io`) and use it as the public webhook endpoint in your payment provider's dashboard. Example webhook URL:

```
https://abcd-1234.ngrok.io/api/payments/webhook/
```

6. Update `ALLOWED_HOSTS` in Django `settings.py` or set it via env var to include the ngrok hostname (or use `['*']` for dev):

```python
ALLOWED_HOSTS = ["localhost", "127.0.0.1", ".ngrok.io"]
```

7. If your payment provider supports a webhook signature secret, set that value in your app (and configure Django to verify it) so you can validate incoming requests.

Testing webhooks:

- Trigger a webhook from your provider's dashboard (or create a test payment). Watch the Django server logs and the ngrok request inspector (http://127.0.0.1:4040) to see incoming requests.

Security tip: ngrok forwarding URLs are public — do not leak them to production logs or commit them to source control. Ngrok sessions may change each run unless you use a reserved domain (paid feature).

## Example `.env` contents

Below are example contents you can copy into `backend/.env` and `frontend/.env` (or `.env.local`) for local development. Keep these files out of source control.

Backend (`backend/.env`):

```ini
# Django core
DJANGO_SECRET_KEY=replace-me-with-a-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (sqlite example) or postgres URL
# DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DBNAME
DATABASE_URL=sqlite:///db.sqlite3

# Email / SMTP
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=your-sendgrid-api-key
DEFAULT_FROM_EMAIL=no-reply@example.com

# Payment provider (example keys)
PAYSTACK_SECRET_KEY=sk_test_xxx
PAYSTACK_PUBLIC_KEY=pk_test_xxx
PAYSTACK_WEBHOOK_SECRET=paystack-webhook-secret

# Optional: ngrok host
NGROK_HOST=abcd-1234.ngrok.io

# Any other secrets / settings for your local environment
```

Frontend (`frontend/.env` or `.env.local`):

```env
# Vite-exposed client variables must be prefixed with VITE_
VITE_API_URL=http://localhost:8000
VITE_FRONTEND_URL=http://localhost:5173
VITE_PAYSTACK_PUBLIC_KEY=pk_test_xxx
```

Copy these into files named `.env` (or use `.env.local` for the frontend) and do not commit them. The backend can load them using `python-dotenv` or `django-environ` in `settings.py`.

## Important Files

- `backend/` — Django project and apps (models, webhook endpoints, admin audit logic)
- `frontend/src/components/VendorDashboard.jsx` — vendor dashboard
- `frontend/src/components/LineChart.jsx` — extracted, self-contained LineChart component with smoothing, zoom, and interactions
- `frontend/src/index.css` — global styles (includes glassmorphism variables and `.pinned-chart`)

## Notes & Next Steps

- Run the app locally and navigate to the vendor dashboard to exercise the chart interactivity (smoothing slider, Shift+wheel vertical zoom, pan/zoom, click to select points).
- Consider adding tests for API endpoints and component-level UI tests for key interactions.
- For production, configure a proper database, static asset build, and deploy both frontend and backend behind secure HTTPS.

## License

This project is an example/demo. Add a license file if you plan to reuse or publish it.

## Contact

Repository maintained locally; contact the author (on the machine) for more details.
