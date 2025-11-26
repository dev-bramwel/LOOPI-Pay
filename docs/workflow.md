This document describes the end-to-end flows implemented in the LOOPI++ project. It is intended for developers and QA to understand how registration, verification, login, payment initiation, QR generation, scanning, Paystack interactions, webhooks, status updates, and cancellation work together.

**Registration & Email Verification**

- **Register (Vendor)**: The frontend sends a POST to `/api/vendors/register/` with vendor details (email, password, business_name, etc.). The backend creates a Vendor record and a one-time verification token (email verification flow).
- **Verification Email**: The backend sends an email containing a verification link/token. The verification endpoint consumes the token and marks the vendor as verified. Email delivery depends on your SMTP/provider configuration.
- **Verify Email**: Visiting the verification link or calling the verification API marks the vendor's email verified. The system enforces email verification before granting meaningful access (e.g., before enabling QR generation or returning full privileges).

**Login / Authentication**

- **Login**: Vendors authenticate via `/api/vendors/login/` (or the configured auth endpoint). Successful login returns JWT tokens (access/refresh) using `rest_framework_simplejwt`. The frontend stores the access token in `localStorage` as `vendorToken`; vendor metadata may be cached as `vendorData`.
- **Protected APIs**: Protected endpoints require `Authorization: Bearer <token>`. The frontend typically uses a helper `getAuthHeaders()` to attach the header.

**Payment Session Lifecycle and QR Generation**

- **Create Payment Session**: Vendors request a new payment session via `/api/vendors/transactions/initiate/` with an `amount`. The backend creates a `PaymentSession`/Transaction with status `pending`, generates a QR image (URL), and returns `session_id`, `amount`, `qr_code`, and metadata.
- **QR payload**: The QR encodes a frontend pay URL like `https://<frontend>/pay?session_id={session_id}` (frontend-pay-route approach). Scanning the QR opens the frontend pay flow on the customer's device.
- **Metadata**: `PaymentSession.metadata` stores transient values such as `paystack_reference`, `authorization_url`, `auto_failed`, and `cancel_attempts` to aid reconciliation and retries.

**Customer Checkout (Frontend flow)**

- **PayRedirect flow**: When a customer visits the frontend pay URL, the `PayRedirect` component will call the public initiate endpoint (if needed) and redirect the browser to Paystack's provided `authorization_url` (checkout). Before redirecting, the frontend stores a mapping in `localStorage` like `pay_ref:<reference> => <session_id>` to help the callback page map Paystack references back to sessions.
- **Public Initiate**: The backend exposes a public initiate endpoint to start a Paystack checkout for anonymous customers. It returns `{ reference, checkout_url, session_id }`. The backend deduplicates references by reusing `authorization_url` from session metadata if present and by generating unique references on duplicate errors.

**Paystack Interaction**

- **Initialize Transaction**: The backend calls Paystack's initialize API; Paystack returns a `reference` and an `authorization_url` (checkout URL). The backend saves these to `PaymentSession.metadata` and returns the `authorization_url` to the frontend.
- **Checkout Complete**: After payment, Paystack may redirect back to the frontend callback route and also emits a webhook to the backend notifying of the charge result.

**Callback & Webhook Handling**

- **Frontend Callback** (`PaymentCallback` component):
  - Reads `reference` from query params. Resolves `session_id` using `localStorage` mapping `pay_ref:<reference>` if available; as a fallback it attempts to parse the session id from the reference format.
  - Polls `/api/payments/status/{session_id}/?reference=<reference>` at a regular interval (typically 6s). The backend may provide `X-Payment-Final` header when final to halt polling immediately.
  - On final states (`paid`/`completed` or `failed`) the callback shows a one-time message and navigates the user back to the vendor dashboard (after a short delay) to improve UX.
- **Paystack Webhook**:
  - Webhook endpoint verifies the HMAC signature using `PAYSTACK_SECRET_KEY` (sha512). The handler resolves the corresponding `PaymentSession` by `session_id` (if included), `reference -> metadata.paystack_reference`, or as a last resort by calling Paystack's verify API.
  - The project persists inbound webhooks to `WebhookAudit` (fields include `received_at`, `event`, `reference`, `payload`, `headers`, `processed`, `result`) for observability.
  - After verification, the backend updates `PaymentSession` and `Transaction` state to `completed/paid` on success or `failed` otherwise, writes the audit result, and returns HTTP 200.

**Payment Status & Polling**

- **Status Endpoint**: `/api/payments/status/{session_id}/` returns the session object and current status (`pending`, `paid`, `completed`, `failed`). For final states the response includes an `X-Payment-Final` header to signal clients to stop polling.
- **Auto-fail / Timeout**: Controlled by `PAYMENT_AUTO_FAIL_MINUTES`. If > 0, the backend marks `pending` sessions as `failed` after the configured minutes (default is 3). On auto-fail the backend attempts a best-effort cancel with Paystack (e.g., disable saved authorizations) and marks `metadata.auto_failed=true`.

**Cancellation**

- **Manual Cancel**: Vendors can cancel an active session via `POST /api/payments/cancel/` with `{ session_id }`. The backend checks ownership, sets the session to `failed`, updates the transaction, and calls a helper to attempt to cancel/disable Paystack authorization. The frontend updates UI and shows a toast on success.
- **Auto-cancel (frontend)**: The vendor dashboard shows a countdown (180s). When the countdown reaches zero, the frontend sends a single cancel request (guarded by `autoCancelSent`) and immediately updates the UI to `failed` to give instant feedback.

**Frontend UX Patterns & Implementation Details**

- **Vendor Dashboard** (`frontend/src/components/VendorDashboard.jsx`):
  - Displays stats, recent transactions, QR generation form, generated QR view, countdown, and scanner.
  - Uses camera scanning via `BarcodeDetector` where available, otherwise falls back to `jsQR` to decode frames from a canvas.
  - Polls `/api/payments/status/{session_id}/` every 6 seconds while a generated QR is `pending`. Uses `finalToastShownRef` to show one-time toasts when session transitions to `completed` or `failed`.
- **Camera Scanning**:
  - `startScan()` requests `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }})`, waits for the `<video>` element to mount, attaches the stream to `videoRef.current.srcObject`, and starts a decode loop (BarcodeDetector or jsQR).
  - Ensure camera permissions are granted and the page is served from a secure context (https) or localhost.
- **PayRedirect** (`frontend/src/PayRedirect.jsx`): stores `pay_ref:<reference> => session_id` in `localStorage` before redirecting to Paystack's checkout to help the callback route map references back to sessions.
- **PaymentCallback** (`frontend/src/PaymentCallback.jsx`): polls status and uses a React ref `shownRef` to prevent duplicate messages/navigation. On final states it navigates to `/vendor/dashboard` after a short pause.

**Observability & Debugging**

- **WebhookAudit**: Every webhook incoming to the server is recorded to `WebhookAudit` with payload and headers stringified. Use `backend/scripts/check_webhook_audit.py` or the Django admin / Django shell to inspect audit rows.
- **Logs**: Key places to look at server logs: webhook HMAC verification, public initiate errors (duplicate_reference), Paystack verify responses, and cancel helper actions.

**Settings & Environment Variables**

- `PAYSTACK_SECRET_KEY`: Paystack secret for webhook HMACs and API calls.
- `VITE_API_URL`, `VITE_FRONTEND_URL` (or `FRONTEND_URL`): used by the frontend to call backend APIs and build return URLs.
- `PAYMENT_AUTO_FAIL_MINUTES`: integer; 0 disables auto-fail; default set to 3 minutes in the project.
- `ALLOWED_HOSTS`: Add tunnel hostnames (ngrok) to avoid `DisallowedHost` errors when testing webhooks or redirects.

**Database & Migrations**

- Ensure migrations are applied before running the server. `WebhookAudit` requires a migration (look for `0004_webhookaudit.py` in `backend/payments/migrations/`).

**Scripts & Automated Tests**

- `backend/scripts/test_payment_flow.py`: end-to-end script that registers and verifies a vendor, logs in, generates a QR, initiates a Paystack checkout, posts a signed webhook to the webhook endpoint, and confirms the session reaches a final `completed` status. Use this to validate server-side flow without manual Paystack interactions.
- `backend/scripts/check_webhook_audit.py`: utility to inspect/create `WebhookAudit` rows.

**Common Failure Modes & Troubleshooting Checklist**

- DisallowedHost: If you see `DisallowedHost`, add the request host to Django's `ALLOWED_HOSTS`.
- Duplicate Paystack reference: Backend handles duplicate_reference by reusing stored `authorization_url` or generating a new unique reference.
- WebhookAudit empty / missing rows: Ensure migrations were applied, and headers/payloads are serializable. Check server logs for exceptions while saving audits.
- Camera scan does not start: Verify page is served from `localhost` or HTTPS; check camera permissions; confirm `videoRef.current` is mounted (the code waits a short while before attaching the stream).

**Developer Notes & Possible Improvements**

- Centralize currency formatting by adding a helper `formatCurrency(amount, currency)` and returning a `currency` field from backend APIs.
- Persist a server-side mapping of Paystack `reference -> session_id` to avoid relying on `localStorage` heuristics.
- Add an admin UI to view and replay `WebhookAudit` entries to aid debugging of failed webhooks.
- Consider adding transactional state-change logs (who cancelled, when) for auditability.

**How to run locally (dev quick steps)**

1. Backend

   - Create a Python virtual environment and install requirements.
   - Set environment variables: at least `PAYSTACK_SECRET_KEY` and `VITE_FRONTEND_URL` / `FRONTEND_URL`.
   - Apply migrations: `python manage.py migrate`.
   - Run server: `python manage.py runserver`.

2. Frontend

   - Install dependencies: `cd frontend && npm install`.
   - Start dev server: `npm run dev`.
   - Ensure `VITE_API_URL` is pointed at the backend dev server (e.g., `http://127.0.0.1:8000`).

3. Run the end-to-end test script (optional)
   - `python backend/scripts/test_payment_flow.py`

**References & Key Files**

- Backend payment logic: `backend/payments/views.py` (initiate, status, webhook, cancel).
- Models: `backend/payments/models.py` (PaymentSession, Transaction, WebhookAudit).
- Frontend: `frontend/src/components/VendorDashboard.jsx`, `frontend/src/PayRedirect.jsx`, `frontend/src/PaymentCallback.jsx`.

See `docs/ENDPOINTS.md` for a quick, shareable list of the API endpoints and notes.
