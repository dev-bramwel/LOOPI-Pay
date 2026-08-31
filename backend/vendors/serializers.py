from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.db import models
from .models import Vendor, Transaction

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.db import models
from .models import Vendor, Transaction


class VendorRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = Vendor
        fields = [
            "email",
            "username",
            "password",
            "password2",
            "business_name",
            "phone",
        ]

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError(
                {"password": "Password fields didn't match."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        vendor = Vendor.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            business_name=validated_data.get("business_name", ""),
            phone=validated_data.get("phone", ""),
        )
        return vendor


class VendorSerializer(serializers.ModelSerializer):
    transaction_count = serializers.SerializerMethodField()
    total_revenue = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = [
            "id",
            "email",
            "username",
            "business_name",
            "phone",
            "is_verified",
            "created_at",
            "transaction_count",
            "total_revenue",
        ]
        read_only_fields = ["id", "email", "is_verified", "created_at"]

    def get_transaction_count(self, obj):
        return obj.transactions.count()

    def get_total_revenue(self, obj):
        total = obj.transactions.filter(status="paid").aggregate(
            total=models.Sum("amount")
        )["total"]
        return float(total) if total else 0.0


class TransactionSerializer(serializers.ModelSerializer):
    vendor_email = serializers.EmailField(source="vendor.email", read_only=True)

    class Meta:
        model = Transaction
        fields = [
            "id",
            "vendor_email",
            "session_id",
            "amount",
            "status",
            "paystack_reference",
            "customer_email",
            "qr_generated",
            "paid_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "session_id",
            "status",
            "paystack_reference",
            "paid_at",
            "created_at",
            "updated_at",
        ]


class InitiateTransactionSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than 0")
        return value
