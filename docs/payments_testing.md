# Payments API Testing

## Initiate Payment

```bash
curl -X POST http://127.0.0.1:8000/api/payments/initiate/   -H "Content-Type: application/json"   -d '{
````markdown
# Payments API & Frontend Testing

This document describes how to exercise the payments flow end-to-end from the frontend, how the frontend polls for payment status, and handy scripts to simulate Paystack events locally.

**Requirements:**
- **Environment:** backend running at `http://127.0.0.1:8000`, frontend at `http://localhost:5173` (adjust `FRONTEND_URL` in `.env` if different).
- **Env vars:** `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `FRONTEND_URL` must be set in `backend/.env`.

**Quick scripts** (already included in this repo):
- `backend/scripts/test_payment_flow.py`: register+verify vendor, login, generate QR, initiate Paystack transaction, simulate webhook (charge.success), check final status.
- `backend/scripts/test_payment_timeout.py`: create a verified vendor, generate a session, backdate `created_at` and call `payment_status` to confirm the 1-minute auto-fail behavior.

**How the Frontend Payment Flow Works**

- **Generate QR (vendor action):**
  - Frontend posts to `POST /api/payments/generate-qr/` with JSON `{ session_id, amount, vendor }` and Authorization header (JWT).
  - Backend registers a `PaymentSession` (status=`pending`) and returns a base64 PNG QR payload plus `session_id` and `amount`.
  - Frontend displays the QR to the customer.

- **Customer pays (external - Paystack):**
  - The customer scans the QR or visits the checkout URL returned by the `initiate` endpoint.
  - The frontend (or server) calls `POST /api/payments/initiate/` to initialize a Paystack transaction; backend calls Paystack and returns `{ reference, checkout_url, session_id }`.

- **Payment completed (Paystack -> webhook):**
  - Paystack posts a webhook to `POST /api/payments/webhook/` (this endpoint is configured to allow unauthenticated requests and validates the HMAC signature using `PAYSTACK_SECRET_KEY`).
  - When a `charge.success` event arrives, the backend sets `PaymentSession.status = 'completed'` and updates the related `Transaction` (if any).

- **Frontend status polling:**
  - The dashboard polls `GET /api/payments/status/:session_id/` every 3 seconds while a `generatedQR` exists.
  - The backend returns JSON `{ session_id, status, amount, vendor }` (vendor is serialized as email).
  - If the backend reports `status: completed` or `status: failed`, the frontend stops polling, refreshes stats and transactions, and updates the UI badge.

- **Timeout rule:**
  - If a `PaymentSession` remains `pending` for more than 1 minute, the next `GET /api/payments/status/:session_id/` call will automatically mark it as `failed` (and attempt to update the related `Transaction`). This is triggered on status requests (polling).

**Manual test steps from the frontend (happy path)**

1. Log in as a verified vendor in the frontend (or use `backend/scripts/test_login.py` to create/verify a test vendor and get tokens).
2. In the dashboard, go to the Generate QR tab and enter an amount; click `Generate QR Code`.
   - The dashboard will POST to `POST /api/payments/generate-qr/` with your vendor JWT in the `Authorization` header.
   - The response contains `qr_code` (data URL), `session_id`, `amount`.
3. Click the provided `Download QR Code` or show the QR to a customer. The dashboard will start polling `GET /api/payments/status/:session_id/` every 3 seconds.
4. Initiate payment (server-side) or simulate using the test script:
   - To simulate the full Paystack checkout + webhook locally, run:
     ```powershell
     python backend\scripts\test_payment_flow.py
     ```
     This script will create a vendor, verify it, login, create a session, call the initiate endpoint (which returns a Paystack `checkout_url` and `reference`) and then POST a simulated `charge.success` webhook to `POST /api/payments/webhook/` using the HMAC signature.
5. The frontend poll will observe `status` change to `completed` and refresh transactions & stats.

**Scanning options (desktop + mobile)**

- The Vendor Dashboard now includes two convenient ways to test scanning:
  - **Open as Customer**: opens `https://<your-frontend>/pay?session_id=<id>` in a new tab (useful for quickly verifying the redirect to Paystack).
  - **Scan with Camera**: opens an in-page camera scanner (modal overlay). On supported Chromium browsers the scanner uses the `BarcodeDetector` API; on unsupported browsers it falls back to `jsQR`.

- Mobile testing (recommended):
  1. Generate a QR in the Vendor Dashboard.
  2. Use your phone camera app to scan the QR — modern phone cameras detect `https://` links and will offer to open them. If the QR is displayed on your laptop screen, point your phone camera at it and accept the link prompt.
  3. Alternatively, click **Download QR Code**, save it to your phone and open the image in your phone's gallery, then tap the link if your phone supports it.

- Screenshot instruction (quick):
  - Take a screenshot of the generated QR on your desktop, send/open that screenshot on your phone, then tap the link overlay or use a QR scanner app to open the `https://.../pay?session_id=...` URL.


**How to simulate a webhook manually (curl)**

1. Create the JSON body for a `charge.success` event, e.g.:
   ```json
   {
     "event": "charge.success",
     "data": { "reference": "<reference-from-initiate>", "status": "success" }
   }
   ```
2. Compute HMAC-SHA512 signature with your `PAYSTACK_SECRET_KEY` over the raw JSON bytes (hex digest). Example (Node/Python/other) — the included `test_payment_flow.py` does this for you.
3. Send the webhook to your local server (replace SIGNATURE):
   ```bash
   curl -X POST http://127.0.0.1:8000/api/payments/webhook/ \
     -H "Content-Type: application/json" \
     -H "X-Paystack-Signature: SIGNATURE" \
     -d '{"event":"charge.success","data":{"reference":"<reference>","status":"success"}}'
   ```

**Testing the 1-minute timeout**

- Quick API-level check (scripted):
  ```powershell
  python backend\scripts\test_payment_timeout.py
  ```
  This script will generate a session and then backdate it by 2 minutes. When it calls `GET /api/payments/status/:session_id/` the backend should auto-mark the session `failed` and return `{"status":"failed"}`.

- Frontend observation:
  - Generate a QR from the dashboard and leave it unpaid. The dashboard polls every 3s; after ~1 minute the poll will receive `status: failed` and the UI will update to show the failure badge.

**Notes & troubleshooting**
- `payment_status` requires authentication from the frontend (it reads the vendor from `PaymentSession.vendor`) — ensure your dashboard includes the `Authorization: Bearer <access>` header when polling. The test scripts include tokens automatically.
- Webhook endpoint is open (`AllowAny`) but validates the `X-Paystack-Signature`; ensure you compute the signature correctly when simulating webhooks.
- In production, set your real `FRONTEND_URL` in the `.env` and register the webhook URL with Paystack so Paystack can call your webhook.

**Useful commands**
- Run the backend dev server:
  ```powershell
  python manage.py runserver
  ```
- Start the frontend dev server (from `frontend` folder):
  ```bash
  npm run dev
  ```
- Run the full payment flow simulation:
  ```powershell
  python backend\scripts\test_payment_flow.py
  ```
- Run the timeout simulation:
  ```powershell
  python backend\scripts\test_payment_timeout.py
  ```

````

## Payment Status

```bash
curl http://127.0.0.1:8000/api/payments/status/test_session_001/
```

## Webhook Test

```bash
curl -X POST http://127.0.0.1:8000/api/payments/webhook/   -H "Content-Type: application/json"   -H "x-paystack-signature: YOUR_COMPUTED_SIGNATURE"   -d '{
    "event": "charge.success",
    "data": {
      "reference": "test_session_001_uuid",
      "status": "success"
    }
  }'
```
