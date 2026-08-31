from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Vendor, Transaction


class TransactionInline(admin.TabularInline):
    model = Transaction
    extra = 0
    readonly_fields = (
        "session_id",
        "amount",
        "status",
        "paystack_reference",
        "paid_at",
        "created_at",
    )


@admin.register(Vendor)
class VendorAdmin(UserAdmin):
    list_display = ["email", "username", "business_name", "is_verified", "created_at"]
    list_filter = ["is_verified", "created_at"]
    search_fields = ["email", "username", "business_name"]
    ordering = ["-created_at"]
    inlines = [TransactionInline]

    fieldsets = tuple(
        list(UserAdmin.fieldsets)
        + [
            (
                "Vendor Info",
                {
                    "fields": (
                        "business_name",
                        "phone",
                        "is_verified",
                        "verification_token",
                    )
                },
            ),
        ]
    )


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = [
        "session_id",
        "vendor",
        "amount",
        "status",
        "qr_generated",
        "created_at",
    ]
    list_filter = ["status", "qr_generated", "created_at"]
    search_fields = ["session_id", "vendor__email", "paystack_reference"]
    readonly_fields = ["id", "session_id", "created_at", "updated_at"]
    ordering = ["-created_at"]
