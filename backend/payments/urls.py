from django.urls import path
from . import views

urlpatterns = [
    path("generate-qr/", views.generate_qr_code, name="generate_qr"),
    path("initiate/", views.initiate_payment, name="initiate_payment"),
    path(
        "public-initiate/",
        views.initiate_payment_public,
        name="initiate_payment_public",
    ),
    path("cancel/", views.cancel_payment, name="cancel_payment"),
    path("webhook/", views.paystack_webhook, name="paystack_webhook"),
    path("status/<str:session_id>/", views.payment_status, name="payment_status"),
    # Admin endpoints (staff-only)
    path("admin/webhook-audits/", views.webhook_audit_list, name="webhook_audit_list"),
    path(
        "admin/webhook-audits/<int:pk>/",
        views.webhook_audit_detail,
        name="webhook_audit_detail",
    ),
    path(
        "admin/webhook-audits/<int:pk>/reprocess/",
        views.webhook_audit_reprocess,
        name="webhook_audit_reprocess",
    ),
]
