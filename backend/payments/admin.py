from django.contrib import admin
from .models import PaymentSession

@admin.register(PaymentSession)
class PaymentSessionAdmin(admin.ModelAdmin):
	list_display = ['session_id', 'vendor', 'amount', 'status', 'created_at']
	list_filter = ['status', 'vendor', 'created_at']
	search_fields = ['session_id', 'vendor', 'paystack_reference']
	readonly_fields = ['id', 'created_at', 'updated_at']
	ordering = ['-created_at']
