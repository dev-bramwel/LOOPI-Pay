import os
import sys
import time
from datetime import timedelta
import requests

# Setup Django environment
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "qr_payment.settings")
import django

django.setup()

from django.utils import timezone
from vendors.models import Vendor
from payments.models import PaymentSession
from rest_framework_simplejwt.tokens import RefreshToken

API_BASE = "http://127.0.0.1:8000"


def make_verified_vendor(email=None):
    suffix = str(int(time.time()))[-6:]
    email = email or f"timeout{suffix}@example.com"
    user, created = Vendor.objects.get_or_create(
        email=email,
        defaults={
            "username": f"user{suffix}",
            "business_name": "Timeout Test",
            "phone": "+10000000000",
        },
    )
    if created:
        user.set_password("SecurePass123!")
    user.is_verified = True
    user.save()
    return user


def get_access_token_for_user(user):
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


def generate_qr(access_token, session_id, amount, vendor_email):
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    payload = {"session_id": session_id, "amount": amount, "vendor": vendor_email}
    r = requests.post(
        f"{API_BASE}/api/payments/generate-qr/", json=payload, headers=headers
    )
    print("GENERATE QR:", r.status_code, r.text)
    r.raise_for_status()
    return r.json()


def call_status(access_token, session_id):
    headers = {"Authorization": f"Bearer {access_token}"}
    r = requests.get(f"{API_BASE}/api/payments/status/{session_id}/", headers=headers)
    print("STATUS CALL:", r.status_code, r.text)
    return r


if __name__ == "__main__":
    print("Creating verified vendor...")
    vendor = make_verified_vendor()
    access = get_access_token_for_user(vendor)

    session_id = f"timeout-{int(time.time())}"
    amount = "10.00"

    print("Generating QR/session...")
    qr = generate_qr(access, session_id, amount, vendor.email)

    # Locate the PaymentSession and backdate created_at to simulate timeout
    ps = PaymentSession.objects.get(session_id=session_id)
    print("Original created_at:", ps.created_at)
    ps.created_at = timezone.now() - timedelta(minutes=2)
    ps.save()
    print("Backdated created_at:", ps.created_at)

    # Call payment_status which should auto-fail the session
    print("Calling payment_status to trigger auto-fail...")
    r = call_status(access, session_id)
    if r.status_code == 200:
        data = r.json()
        status = data.get("status")
        if status == "failed":
            print("SUCCESS: Session was auto-marked failed as expected.")
        else:
            print("UNEXPECTED STATUS:", status)
    else:
        print("Error calling status endpoint")
