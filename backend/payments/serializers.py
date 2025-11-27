from rest_framework import serializers
from .models import PaymentSession
from .models import WebhookAudit

class PaymentInitiateSerializer(serializers.Serializer):
    session_id = serializers.CharField(required=True)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    vendor = serializers.CharField(required=True)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than 0")
        return value

class PaymentSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentSession
        fields = ['id', 'session_id', 'amount', 'vendor', 'status',
                  'paystack_reference', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class WebhookAuditSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookAudit
        fields = ['id', 'received_at', 'event', 'reference', 'payload', 'headers', 'processed', 'result']
        read_only_fields = ['id', 'received_at']
