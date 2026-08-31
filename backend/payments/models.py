import uuid
from django.db import models
from django.conf import settings


class PaymentSession(models.Model):
    """Represents a payment session initiated for a vendor or a guest.

    Fields:
    - id: UUID primary key
    - session_id: external / readable session identifier (unique)
    - amount: Decimal amount in main currency units (e.g., Naira)
    - vendor: optional FK to vendor (AUTH_USER_MODEL)
    - status: one of pending/completed/failed
    - paystack_reference: reference returned by Paystack (nullable)
    - metadata: optional JSON payload
    - created_at / updated_at timestamps
    """

    STATUS_PENDING = "pending"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_id = models.CharField(max_length=255, unique=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    vendor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True
    )
    status = models.CharField(
        max_length=32, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    paystack_reference = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"PaymentSession(session_id={self.session_id}, amount={self.amount}, status={self.status})"


class WebhookAudit(models.Model):
    """Stores incoming webhook payloads and processing results for debugging/audit.

    Fields:
    - id: auto
    - received_at: timestamp
    - event: webhook event name (e.g., charge.success)
    - reference: the paystack reference (if present)
    - payload: JSON of the full webhook body
    - headers: JSON of request headers
    - processed: boolean whether the app processed the event
    - result: optional short description/result of processing
    """

    received_at = models.DateTimeField(auto_now_add=True)
    event = models.CharField(max_length=128, blank=True, null=True)
    reference = models.CharField(max_length=255, blank=True, null=True)
    payload = models.JSONField(null=True, blank=True)
    headers = models.JSONField(null=True, blank=True)
    processed = models.BooleanField(default=False)
    result = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-received_at"]

    def __str__(self):
        return f"WebhookAudit(event={self.event}, reference={self.reference}, at={self.received_at})"
