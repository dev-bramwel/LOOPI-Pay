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
