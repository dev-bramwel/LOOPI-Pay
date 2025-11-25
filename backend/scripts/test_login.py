import requests
import json

REGISTER_URL = 'http://127.0.0.1:8000/api/vendors/register/'
LOGIN_URL = 'http://127.0.0.1:8000/api/vendors/login/'

import time

suffix = str(int(time.time()))[-4:]
reg_payload = {
    "email": f"vendor{suffix}@test.com",
    "username": f"testvendor{suffix}",
    "password": "SecurePass123!",
    "password2": "SecurePass123!",
    "business_name": "Test Business",
    "phone": "+1234567890"
}

login_payload = {"email": reg_payload["email"], "password": "SecurePass123!"}

def do_post(url, payload):
    try:
        r = requests.post(url, json=payload)
        print('\nPOST', url)
        print('STATUS:', r.status_code)
        print('BODY:', r.text)
        return r
    except Exception as e:
        print('ERROR:', e)
        return None


if __name__ == '__main__':
    print('Attempting registration...')
    r = do_post(REGISTER_URL, reg_payload)

    # If registration succeeded, fetch verification token from DB and call verify endpoint
    if r is not None and r.status_code == 201:
        print('\nFetching verification token from local DB and calling verify endpoint...')
        try:
            import os, sys
            # Ensure project backend folder is on sys.path so Django settings package is importable
            BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            if BASE_DIR not in sys.path:
                sys.path.insert(0, BASE_DIR)
            os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'qr_payment.settings')
            import django
            django.setup()
            from vendors.models import Vendor

            vendor = Vendor.objects.get(email=reg_payload['email'])
            token = getattr(vendor, 'verification_token', None)

            if token:
                verify_url = f'http://127.0.0.1:8000/api/vendors/verify-email/?token={token}'
                print('CALL:', verify_url)
                vr = requests.get(verify_url)
                print('VERIFY STATUS:', vr.status_code)
                print('VERIFY BODY:', vr.text)
            else:
                print('No verification token found on vendor object.')
        except Exception as e:
            print('Error fetching token or calling verify endpoint:', e)
    else:
        # If registration didn't return 201, ensure a vendor exists in the DB with the test email.
        print('\nRegistration did not return 201; creating vendor in DB for test and verifying...')
        try:
            import os, sys
            BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            if BASE_DIR not in sys.path:
                sys.path.insert(0, BASE_DIR)
            os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'qr_payment.settings')
            import django
            django.setup()
            import secrets
            from vendors.models import Vendor

            vendor, created = Vendor.objects.get_or_create(email=reg_payload['email'], defaults={
                'username': reg_payload['username'],
                'business_name': reg_payload['business_name'],
                'phone': reg_payload['phone']
            })
            if created:
                vendor.set_password(reg_payload['password'])
            # ensure verification token exists
            if not getattr(vendor, 'verification_token', None):
                vendor.verification_token = secrets.token_urlsafe(32)
            vendor.is_verified = False
            vendor.save()

            token = vendor.verification_token
            verify_url = f'http://127.0.0.1:8000/api/vendors/verify-email/?token={token}'
            print('CALL:', verify_url)
            vr = requests.get(verify_url)
            print('VERIFY STATUS:', vr.status_code)
            print('VERIFY BODY:', vr.text)
        except Exception as e:
            print('Error creating vendor or calling verify endpoint:', e)

    print('\nAttempting login...')
    do_post(LOGIN_URL, login_payload)
