from django.urls import path
from . import views

urlpatterns = [
    path('generate-qr/', views.generate_qr_code, name='generate_qr'),
    path('initiate/', views.initiate_payment, name='initiate_payment'),
    path('webhook/', views.paystack_webhook, name='paystack_webhook'),
    path('status/<str:session_id>/', views.payment_status, name='payment_status'),
]
