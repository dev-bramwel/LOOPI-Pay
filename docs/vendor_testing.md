# Vendor API Testing

## Registration

``` bash
curl -X POST http://127.0.0.1:8000/api/vendors/register/   -H "Content-Type: application/json"   -d '{
    "email": "vendor@test.com",
    "username": "testvendor",
    "password": "SecurePass123!",
    "password2": "SecurePass123!",
    "business_name": "Test Business",
    "phone": "+1234567890"
  }'
```

## Login

``` bash
curl -X POST http://127.0.0.1:8000/api/vendors/login/   -H "Content-Type: application/json"   -d '{
    "email": "vendor@test.com",
    "password": "SecurePass123!"
  }'
```

## Get Profile

``` bash
curl -X GET http://127.0.0.1:8000/api/vendors/profile/   -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Initiate Transaction

``` bash
curl -X POST http://127.0.0.1:8000/api/vendors/transactions/initiate/   -H "Authorization: Bearer YOUR_ACCESS_TOKEN"   -H "Content-Type: application/json"   -d '{
    "amount": 500
  }'
```

## All Transactions

``` bash
curl -X GET http://127.0.0.1:8000/api/vendors/transactions/   -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Dashboard Stats

``` bash
curl -X GET http://127.0.0.1:8000/api/vendors/dashboard/stats/   -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```
