import os
import sys
import time
import json
import hmac
import hashlib
import requests

from dotenv import load_dotenv

# Prepare Django environment to read settings if needed
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'qr_payment.settings')
import django
django.setup()

load_dotenv(os.path.join(BASE_DIR, '.env'))

from vendors.models import Vendor

API_BASE = 'http://127.0.0.1:8000'

def register_and_verify():
    suffix = str(int(time.time()))[-6:]
    email = f'paytest{suffix}@example.com'
    reg_payload = {
        'email': email,
        'username': f'payuser{suffix}',
        'password': 'SecurePass123!',
        'password2': 'SecurePass123!',
        'business_name': 'Payment Test Co',
        'phone': '+10000000000'
    }

    r = requests.post(f'{API_BASE}/api/vendors/register/', json=reg_payload)
    print('REGISTER STATUS:', r.status_code)
    print('REGISTER BODY:', r.text)

    # Fetch vendor and verification token from DB
    vendor = Vendor.objects.get(email=email)
    token = getattr(vendor, 'verification_token', None)
    if not token:
        raise RuntimeError('No verification token found')

    verify_url = f'{API_BASE}/api/vendors/verify-email/?token={token}'
    vr = requests.get(verify_url)
    print('VERIFY STATUS:', vr.status_code)
    print('VERIFY BODY:', vr.text)

    return email

def login(email):
    payload = {'email': email, 'password': 'SecurePass123!'}
    r = requests.post(f'{API_BASE}/api/vendors/login/', json=payload)
    print('LOGIN STATUS:', r.status_code)
    print('LOGIN BODY:', r.text)
    if r.status_code != 200:
        raise RuntimeError('Login failed')
    data = r.json()
    return data['tokens']['access']

def generate_qr(access_token, session_id, amount, vendor_email):
    headers = {'Authorization': f'Bearer {access_token}'}
    payload = {'session_id': session_id, 'amount': amount, 'vendor': vendor_email}
    r = requests.post(f'{API_BASE}/api/payments/generate-qr/', json=payload, headers=headers)
    print('GENERATE QR STATUS:', r.status_code)
    print('GENERATE QR BODY:', r.text[:1000])
    if r.status_code != 201:
        raise RuntimeError('QR generation failed')
    return r.json()

def initiate_payment(access_token, session_id, amount, vendor_email):
    headers = {'Authorization': f'Bearer {access_token}'}
    payload = {'session_id': session_id, 'amount': amount, 'vendor': vendor_email}
    r = requests.post(f'{API_BASE}/api/payments/initiate/', json=payload, headers=headers)
    print('INITIATE STATUS:', r.status_code)
    print('INITIATE BODY:', r.text)
    if r.status_code != 200:
        raise RuntimeError('Initiate failed')
    return r.json()

def simulate_paystack_webhook(reference):
    # Build a minimal charge.success payload expected by webhook
    event = {
        'event': 'charge.success',
        'data': {
            'reference': reference,
            'status': 'success'
        }
    }
    body = json.dumps(event).encode('utf-8')

    secret = os.getenv('PAYSTACK_SECRET_KEY')
    if not secret:
        raise RuntimeError('PAYSTACK_SECRET_KEY not set in environment')

    signature = hmac.new(secret.encode('utf-8'), body, hashlib.sha512).hexdigest()

    headers = {
        'Content-Type': 'application/json',
        'X-Paystack-Signature': signature
    }

    r = requests.post(f'{API_BASE}/api/payments/webhook/', data=body, headers=headers)
    print('WEBHOOK STATUS:', r.status_code)
    print('WEBHOOK BODY:', r.text)
    return r.status_code

def check_status(session_id, access_token=None):
    headers = {}
    if access_token:
        headers['Authorization'] = f'Bearer {access_token}'
    r = requests.get(f'{API_BASE}/api/payments/status/{session_id}/', headers=headers)
    print('STATUS CHECK:', r.status_code, r.text)
    return r.json() if r.status_code == 200 else None

if __name__ == '__main__':
    print('Starting payment flow test...')
    email = register_and_verify()
    access = login(email)

    session_id = f'sess-{int(time.time())}'
    amount = '50.00'

    qr = generate_qr(access, session_id, amount, email)
    print('QR generated. Session:', qr.get('session_id'))

    init = initiate_payment(access, session_id, amount, email)
    reference = init.get('reference')
    checkout = init.get('checkout_url')
    print('Paystack reference:', reference)
    print('Checkout URL:', checkout)

    # Simulate webhook from Paystack
    simulate_paystack_webhook(reference)

    # Allow backend to process
    time.sleep(1)

    status = check_status(session_id, access)
    print('Final payment status:', status)
