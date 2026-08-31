from django.contrib import admin
from .models import WebhookAudit, PaymentSession
from django.utils.html import format_html
from django.utils import timezone
from vendors.models import Transaction


@admin.register(WebhookAudit)
class WebhookAuditAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "reference", "received_at", "processed")
    list_filter = (
        "processed",
        "event",
    )
    search_fields = ("reference", "event", "result")
    readonly_fields = ("received_at", "payload", "headers", "result")
    actions = ("reprocess_webhooks",)

    @admin.action(description="Reprocess selected webhook audits")
    def reprocess_webhooks(self, request, queryset):
        """Admin action to re-run processing logic for selected webhook audits."""
        processed = 0
        for audit in queryset:
            try:
                payload = audit.payload or {}
                event_type = payload.get("event")
                data = payload.get("data", {})
                reference = data.get("reference") or audit.reference

                # Try to resolve PaymentSession by reference
                ps = None
                if reference:
                    ps = PaymentSession.objects.filter(
                        paystack_reference=reference
                    ).first()

                # Fallback: try metadata.session_id from payload
                if not ps:
                    md = data.get("metadata", {}) or {}
                    sid = md.get("session_id")
                    if sid:
                        ps = PaymentSession.objects.filter(session_id=sid).first()

                if not ps:
                    # Last-resort: try to find by audit.reference stored on audit
                    if audit.reference:
                        ps = PaymentSession.objects.filter(
                            paystack_reference=audit.reference
                        ).first()

                if not ps:
                    audit.result = "reprocess:session_not_found"
                    audit.processed = False
                    audit.save()
                    continue

                # Ignore if session already failed due to auto-fail
                meta = getattr(ps, "metadata", {}) or {}
                if meta.get("auto_failed") or ps.status == PaymentSession.STATUS_FAILED:
                    audit.result = f"reprocess:ignored_auto_failed:{ps.session_id}"
                    audit.processed = True
                    audit.save()
                    processed += 1
                    continue

                # Apply event semantics similar to live webhook handler
                if event_type == "charge.success":
                    ps.status = PaymentSession.STATUS_COMPLETED
                    # update Transaction if present
                    try:
                        tx = Transaction.objects.get(session_id=ps.session_id)
                        tx.status = "paid"
                        tx.paid_at = timezone.now()
                        tx.paystack_reference = reference or tx.paystack_reference
                        tx.save()
                    except Transaction.DoesNotExist:
                        pass
                elif event_type == "charge.failed":
                    ps.status = PaymentSession.STATUS_FAILED
                    try:
                        tx = Transaction.objects.get(session_id=ps.session_id)
                        tx.status = "failed"
                        tx.save()
                    except Transaction.DoesNotExist:
                        pass

                ps.save()
                audit.processed = True
                audit.result = f"reprocessed:event={event_type},session={ps.session_id}"
                audit.save()
                processed += 1
            except Exception as e:
                audit.result = f"reprocess_error:{str(e)[:200]}"
                audit.processed = False
                audit.save()

        self.message_user(request, f"Reprocessed {processed} webhook(s)")


@admin.register(PaymentSession)
class PaymentSessionAdmin(admin.ModelAdmin):
    list_display = (
        "session_id",
        "vendor",
        "amount",
        "status",
        "paystack_reference",
        "created_at",
    )
    list_filter = ("status", "vendor")
    search_fields = ("session_id", "paystack_reference", "vendor__email")
    readonly_fields = ("created_at", "updated_at")
