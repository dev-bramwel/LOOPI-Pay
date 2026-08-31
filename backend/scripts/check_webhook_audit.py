import os, sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "qr_payment.settings")
import django

django.setup()
from payments.models import WebhookAudit

print("WebhookAudit count:", WebhookAudit.objects.count())
for a in WebhookAudit.objects.all()[:10]:
    print(a.received_at, a.event, a.reference, a.processed, a.result)
try:
    wa = WebhookAudit.objects.create(
        event="selftest",
        reference="selftest-ref",
        payload={"ok": True},
        headers={"x": "y"},
    )
    print("Created test audit id:", wa.pk)
except Exception as e:
    print("Failed to create test audit:", e)
