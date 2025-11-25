import requests
import json

REGISTER_URL = 'http://127.0.0.1:8000/api/vendors/register/'
LOGIN_URL = 'http://127.0.0.1:8000/api/vendors/login/'

reg_payload = {
    "email": "bramwel495@gmail.com",
    "username": "bramwel495",
    "password": "SecurePass123!",
    "password2": "SecurePass123!",
    "business_name": "Bram's Test Business",
    "phone": "+10000000000"
}

login_payload = {"email": reg_payload["email"], "password": reg_payload["password"]}


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
    print('Attempting registration for bramwel495@gmail.com...')
    r = do_post(REGISTER_URL, reg_payload)

    print('\nAttempting immediate login (no verification)...')
    do_post(LOGIN_URL, login_payload)
