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
    do_post(REGISTER_URL, reg_payload)
    print('Attempting login...')
    do_post(LOGIN_URL, login_payload)
