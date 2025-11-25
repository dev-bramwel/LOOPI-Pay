## 🚀 Setup Instructions

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies (including new ones for vendors app)
pip install -r requirements.txt

# Create .env file and add your Paystack keys
cp .env.example .env
# Edit .env with your actual keys

# IMPORTANT: Delete existing database (if any) since we're changing the user model
rm db.sqlite3
rm -rf */migrations/000*.py  # Keep __init__.py files

# Create migrations for all apps
python manage.py makemigrations vendors
python manage.py makemigrations payments
python manage.py migrate

# Create superuser (optional - this will be a Vendor account)
python manage.py createsuperuser

# Start Django server
python manage.py runserver
```

### 2. Setup Ngrok

```bash
# Install ngrok from https://ngrok.com/download

# Start ngrok tunnel
ngrok http 8000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update backend/.env with:
# NGROK_URL=https://abc123.ngrok.io

# Configure Paystack webhook:
# Go to Paystack Dashboard > Settings > Webhooks
# Set webhook URL to: https://abc123.ngrok.io/api/payments/webhook/
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (including react-router-dom)
npm install

# Create .env file
cp .env.example .env

# Start development server
npm run dev
```

**Note:** If you get any router errors, ensure react-router-dom is installed:

```bash
npm install react-router-dom
```

### 4. Generate Test QR Codes

```bash
# Install qrcode library
pip install qrcode[pil]

# Generate QR code
python scripts/generate_qr.py abc123 500 Vendor_A
```

---

## 🧪 Testing with cURL

### Vendor Registration and Authentication

```bash
# Register a new vendor
curl -X POST http://127.0.0.1:8000/api/vendors/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vendor@test.com",
    "username": "testvendor",
    "password": "SecurePass123!",
    "password2": "SecurePass123!",
    "business_name": "Test Business",
    "phone": "+1234567890"
  }'

# Login
curl -X POST http://127.0.0.1:8000/api/vendors/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vendor@test.com",
    "password": "SecurePass123!"
  }'

# Save the access token from the response, then:

# Get Profile
curl -X GET http://127.0.0.1:8000/api/vendors/profile/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Initiate Transaction (Generate QR)
curl -X POST http://127.0.0.1:8000/api/vendors/transactions/initiate/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500
  }'

# Get All Transactions
curl -X GET http://127.0.0.1:8000/api/vendors/transactions/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get Dashboard Stats
curl -X GET http://127.0.0.1:8000/api/vendors/dashboard/stats/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Test Payment Initiation

```bash
curl -X POST http://127.0.0.1:8000/api/payments/initiate/ \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test_session_001",
    "amount": 500,
    "vendor": "Vendor_A"
  }'
```

### Test Payment Status

```bash
curl http://127.0.0.1:8000/api/payments/status/test_session_001/
```

### Test Webhook (Mock)

```bash
# This requires computing the HMAC signature
# Use Paystack's test tools or webhook testing services
curl -X POST http://127.0.0.1:8000/api/payments/webhook/ \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: YOUR_COMPUTED_SIGNATURE" \
  -d '{
    "event": "charge.success",
    "data": {
      "reference": "test_session_001_uuid",
      "status": "success"
    }
  }'
```

---

## 📝 Usage Flow

1. **Start Backend**: Run Django server on port 8000
2. **Start Ngrok**: Tunnel port 8000 and configure webhook
3. **Start Frontend**: Run React app on port 5173
4. **Generate QR**: Create test QR codes with payment data
5. **Scan QR**: Use frontend to scan QR code
6. **Initiate Payment**: Frontend sends payload to backend
7. **Pay**: User is redirected to Paystack checkout
8. **Webhook**: Paystack notifies backend of payment status
9. **Verify**: Check payment status in frontend
