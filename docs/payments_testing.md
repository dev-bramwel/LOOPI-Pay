# Payments API Testing

## Initiate Payment

```bash
curl -X POST http://127.0.0.1:8000/api/payments/initiate/   -H "Content-Type: application/json"   -d '{
    "session_id": "test_session_001",
    "amount": 500,
    "vendor": "Vendor_A"
  }'
```

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
