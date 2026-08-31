from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Vendor


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="http://localhost:5173",
)
class EmailVerificationFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.registration = {
            "email": "vendor@example.com",
            "username": "testvendor",
            "password": "A-secure-password-123",
            "password2": "A-secure-password-123",
            "business_name": "Test Business",
            "phone": "+254700000000",
        }

    def test_registration_sends_frontend_verification_link(self):
        response = self.client.post(
            "/api/vendors/register/", self.registration, format="json"
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("http://localhost:5173/vendor/verify?token=", mail.outbox[0].body)

    def test_verification_returns_tokens(self):
        self.client.post("/api/vendors/register/", self.registration, format="json")
        vendor = Vendor.objects.get(email=self.registration["email"])

        response = self.client.get(
            "/api/vendors/verify-email/",
            {"token": vendor.verification_token},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data["tokens"])
        self.assertTrue(response.data["vendor"]["is_verified"])
