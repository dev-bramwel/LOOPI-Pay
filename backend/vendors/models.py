import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models

class Vendor(AbstractUser):
	"""
	Custom vendor user model extending Django's AbstractUser
	"""
	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	email = models.EmailField(unique=True)
	business_name = models.CharField(max_length=255, blank=True)
	phone = models.CharField(max_length=20, blank=True)
	is_verified = models.BooleanField(default=False)
	verification_token = models.CharField(max_length=100, blank=True, null=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	USERNAME_FIELD = 'email'
	REQUIRED_FIELDS = ['username']

	class Meta:
		ordering = ['-created_at']

	def __str__(self):
		return self.email

class Transaction(models.Model):
	"""
	Track all transactions initiated by vendors
	"""
	STATUS_CHOICES = [
		('pending', 'Pending'),
		('paid', 'Paid'),
		('failed', 'Failed'),
	]

	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name='transactions')
	session_id = models.CharField(max_length=255, unique=True, db_index=True)
	amount = models.DecimalField(max_digits=10, decimal_places=2)
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
	paystack_reference = models.CharField(max_length=255, blank=True, null=True)
	customer_email = models.EmailField(blank=True, null=True)
	qr_generated = models.BooleanField(default=False)
	paid_at = models.DateTimeField(blank=True, null=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['vendor', 'status']),
			models.Index(fields=['session_id']),
		]

	def __str__(self):
		return f"{self.session_id} - {self.vendor.email} - {self.status}"
