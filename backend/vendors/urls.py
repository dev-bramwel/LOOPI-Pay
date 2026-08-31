from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Authentication
    path("register/", views.register_vendor, name="vendor_register"),
    path("login/", views.login_vendor, name="vendor_login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # Profile
    path("profile/", views.vendor_profile, name="vendor_profile"),
    path("profile/update/", views.update_vendor_profile, name="update_vendor_profile"),
    # Transactions
    path(
        "transactions/initiate/",
        views.initiate_transaction,
        name="initiate_transaction",
    ),
    path("transactions/", views.vendor_transactions, name="vendor_transactions"),
    path(
        "transactions/<str:session_id>/",
        views.transaction_detail,
        name="transaction_detail",
    ),
    # Dashboard
    path("dashboard/stats/", views.vendor_dashboard_stats, name="dashboard_stats"),
    # Email verification
    path("verify-email/", views.verify_email, name="verify_email"),
]
