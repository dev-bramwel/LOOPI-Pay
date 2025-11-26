# API Endpoints — LOOPI++

This file lists the main HTTP endpoints used by the frontend and backend for quick reference.

| Method | Path                                            |          Auth | Purpose                                                                                  |
| ------ | ----------------------------------------------- | ------------: | ---------------------------------------------------------------------------------------- |
| POST   | `/api/vendors/register/`                        |            No | Register a new vendor (creates verification token)                                       |
| POST   | `/api/vendors/verify-email/?token=...`          |            No | Verify vendor email (token from email)                                                   |
| POST   | `/api/vendors/login/`                           |            No | Vendor login — returns JWT tokens                                                        |
| GET    | `/api/vendors/dashboard/stats/`                 |           Yes | Fetch vendor dashboard statistics                                                        |
| GET    | `/api/vendors/transactions/`                    |           Yes | List vendor transactions                                                                 |
| POST   | `/api/vendors/transactions/initiate/`           |           Yes | Vendor-initiated flow: create payment session / generate QR (used by dashboard)          |
| POST   | `/api/payments/generate-qr/`                    |           Yes | Alternate QR generation endpoint (payments app)                                          |
| POST   | `/api/payments/initiate/`                       |           Yes | Authenticated payment initialization with Paystack                                       |
| GET    | `/api/payments/public-initiate/?session_id=...` |            No | Public initiate for scanned QR — returns `reference` + `checkout_url`                    |
| POST   | `/api/payments/cancel/`                         |           Yes | Cancel a payment session (vendor)                                                        |
| POST   | `/api/payments/webhook/`                        | No (Paystack) | Paystack webhook endpoint (HMAC verified)                                                |
| GET    | `/api/payments/status/{session_id}/`            |      AllowAny | Get payment session status (frontend polling). Returns `X-Payment-Final` on final states |

Notes

- `Auth` indicates whether the endpoint requires a vendor JWT (Yes) or is public (No). The webhook endpoint is called by Paystack and therefore does not use user auth.
- The `public-initiate` endpoint expects `session_id` as a query parameter and returns the Paystack `reference` and `checkout_url` so the frontend can redirect the customer.
- For QA: use the `backend/scripts/test_payment_flow.py` script to exercise many of these endpoints end-to-end.
