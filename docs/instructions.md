# QR-Based Payment System with Django & React

Complete implementation of a QR code payment system using Paystack, Django backend with vendor management, and React frontend.

## ✨ Key Features

### Vendor Features

- ✅ **Vendor Registration & Login** with email/password authentication
- ✅ **Email Verification** (auto-enabled in development)
- ✅ **JWT Authentication** for secure API access
- ✅ **Vendor Dashboard** with transaction statistics
- ✅ **Automatic Session ID Generation** using timestamp + vendor email
- ✅ **QR Code Generation** - vendors only input amount
- ✅ **Transaction Tracking** - view all initiated payments
- ✅ **Revenue Analytics** - total and daily revenue tracking
- ✅ **Transaction History** with filtering by status

### Customer Features

- ✅ **QR Code Scanning** using device camera
- ✅ **Payment Processing** via Paystack
- ✅ **Payment Status Checking** in real-time
- ✅ **Multiple Payment Methods** through Paystack

### Technical Features

- ✅ **Custom User Model** (Vendor as Django user)
- ✅ **JWT Token Authentication** with refresh tokens
- ✅ **Webhook Integration** for payment status updates
- ✅ **CORS Configuration** for frontend-backend communication
- ✅ **Transaction Synchronization** between Payment and Vendor models

---

Complete implementation of a QR code payment system using Paystack, Django backend, and React frontend.

## 📁 Project Structure

```
qr-payment-system/
├── backend/                    # Django project
│   ├── qr_payment/            # Django project settings
│   │   ├── __init__.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── payments/              # Payments app
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   └── migrations/
│   ├── manage.py
│   ├── requirements.txt
│   └── .env
├── frontend/                  # React app
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   └── .env
└── scripts/
    └── generate_qr.py
```

---

## 🔧 Backend Setup (Django)

### 1. Install Dependencies

**requirements.txt**

```txt
Django==4.2.7
djangorestframework==3.14.0
django-cors-headers==4.3.1
requests==2.31.0
python-dotenv==1.0.0
```

### 2. Environment Configuration

**backend/.env**

```env
SECRET_KEY=your-django-secret-key-here
DEBUG=True
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key
FRONTEND_URL=http://localhost:5173
NGROK_URL=https://your-ngrok-url.ngrok.io
```

### 3. Django Settings

**backend/qr_payment/settings.py**

```python
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-default-key-change-this')
DEBUG = os.getenv('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = ['127.0.0.1', 'localhost', '.ngrok.io', '.ngrok-free.app']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'payments',
    'vendors',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'qr_payment.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'qr_payment.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model
AUTH_USER_MODEL = 'vendors.Vendor'

# CORS Settings
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
CORS_ALLOW_CREDENTIALS = True

# REST Framework Settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

# JWT Settings
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': False,
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Email Settings (for account verification)
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'  # For development
# For production, use SMTP:
# EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
# EMAIL_HOST = 'smtp.gmail.com'
# EMAIL_PORT = 587
# EMAIL_USE_TLS = True
# EMAIL_HOST_USER = 'your-email@gmail.com'
# EMAIL_HOST_PASSWORD = 'your-app-password'

# Paystack Settings
PAYSTACK_SECRET_KEY = os.getenv('PAYSTACK_SECRET_KEY')
PAYSTACK_PUBLIC_KEY = os.getenv('PAYSTACK_PUBLIC_KEY')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
```

### 4. Models

**backend/payments/models.py**

```python
import uuid
from django.db import models

class PaymentSession(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_id = models.CharField(max_length=255, unique=True, db_index=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    vendor = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    paystack_reference = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['session_id']),
            models.Index(fields=['paystack_reference']),
        ]

    def __str__(self):
        return f"{self.session_id} - {self.status}"
```

### 5. Serializers

**backend/payments/serializers.py**

```python
from rest_framework import serializers
from .models import PaymentSession

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
```

**backend/vendors/**init**.py** (empty file)

**backend/vendors/apps.py**

```python
from django.apps import AppConfig

class VendorsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'vendors'
```

**backend/vendors/models.py**

```python
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
```

**backend/vendors/serializers.py**

```python
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import Vendor, Transaction

class VendorRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = Vendor
        fields = ['email', 'username', 'password', 'password2', 'business_name', 'phone']

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        vendor = Vendor.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            business_name=validated_data.get('business_name', ''),
            phone=validated_data.get('phone', ''),
        )
        return vendor

class VendorSerializer(serializers.ModelSerializer):
    transaction_count = serializers.SerializerMethodField()
    total_revenue = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = ['id', 'email', 'username', 'business_name', 'phone',
                  'is_verified', 'created_at', 'transaction_count', 'total_revenue']
        read_only_fields = ['id', 'email', 'is_verified', 'created_at']

    def get_transaction_count(self, obj):
        return obj.transactions.count()

    def get_total_revenue(self, obj):
        total = obj.transactions.filter(status='paid').aggregate(
            total=models.Sum('amount')
        )['total']
        return float(total) if total else 0.0

class TransactionSerializer(serializers.ModelSerializer):
    vendor_email = serializers.EmailField(source='vendor.email', read_only=True)

    class Meta:
        model = Transaction
        fields = ['id', 'vendor_email', 'session_id', 'amount', 'status',
                  'paystack_reference', 'customer_email', 'qr_generated',
                  'paid_at', 'created_at', 'updated_at']
        read_only_fields = ['id', 'session_id', 'status', 'paystack_reference',
                           'paid_at', 'created_at', 'updated_at']

class InitiateTransactionSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than 0")
        return value
```

**backend/vendors/views.py**

```python
import uuid
import secrets
import qrcode
import io
import base64
import json
from datetime import datetime
from django.contrib.auth import get_user_model
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Vendor, Transaction
from .serializers import (
    VendorRegistrationSerializer,
    VendorSerializer,
    TransactionSerializer,
    InitiateTransactionSerializer
)
from payments.models import PaymentSession
import logging

logger = logging.getLogger(__name__)

User = get_user_model()

@api_view(['POST'])
@permission_classes([AllowAny])
def register_vendor(request):
    """
    Register a new vendor
    """
    serializer = VendorRegistrationSerializer(data=request.data)

    if serializer.is_valid():
        vendor = serializer.save()

        # Generate verification token
        verification_token = secrets.token_urlsafe(32)
        vendor.verification_token = verification_token
        vendor.save()

        # TODO: Send verification email
        logger.info(f"Vendor registered: {vendor.email}")
        logger.info(f"Verification token: {verification_token}")

        # For now, auto-verify in development
        vendor.is_verified = True
        vendor.save()

        # Generate tokens
        refresh = RefreshToken.for_user(vendor)

        return Response({
            'message': 'Vendor registered successfully',
            'vendor': VendorSerializer(vendor).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def login_vendor(request):
    """
    Login vendor and return JWT tokens
    """
    email = request.data.get('email')
    password = request.data.get('password')

    if not email or not password:
        return Response(
            {'error': 'Email and password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        vendor = Vendor.objects.get(email=email)
    except Vendor.DoesNotExist:
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if not vendor.check_password(password):
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if not vendor.is_verified:
        return Response(
            {'error': 'Please verify your email before logging in'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Generate tokens
    refresh = RefreshToken.for_user(vendor)

    return Response({
        'message': 'Login successful',
        'vendor': VendorSerializer(vendor).data,
        'tokens': {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def vendor_profile(request):
    """
    Get vendor profile
    """
    vendor = request.user
    return Response(VendorSerializer(vendor).data)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_vendor_profile(request):
    """
    Update vendor profile
    """
    vendor = request.user
    serializer = VendorSerializer(vendor, data=request.data, partial=True)

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def initiate_transaction(request):
    """
    Vendor initiates a new transaction and generates QR code
    """
    serializer = InitiateTransactionSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    vendor = request.user
    amount = serializer.validated_data['amount']

    # Generate unique session_id using timestamp and vendor email
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
    session_id = f"{vendor.email.split('@')[0]}_{timestamp}"

    # Create transaction record
    transaction = Transaction.objects.create(
        vendor=vendor,
        session_id=session_id,
        amount=amount,
        status='pending',
        qr_generated=True
    )

    # Create payment session (for compatibility with existing payment flow)
    payment_session = PaymentSession.objects.create(
        session_id=session_id,
        amount=amount,
        vendor=vendor.email,
        status='pending'
    )

    # Generate QR code
    payload = {
        "session_id": session_id,
        "amount": float(amount),
        "vendor": vendor.email
    }
    qr_data = json.dumps(payload)

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()

    logger.info(f"Transaction initiated by {vendor.email}: {session_id}")

    return Response({
        'transaction': TransactionSerializer(transaction).data,
        'qr_code': f"data:image/png;base64,{img_str}",
        'session_id': session_id,
        'amount': str(amount),
        'message': 'Transaction initiated successfully'
    }, status=status.HTTP_201_CREATED)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def vendor_transactions(request):
    """
    Get all transactions for the logged-in vendor
    """
    vendor = request.user
    transactions = Transaction.objects.filter(vendor=vendor)

    # Filter by status if provided
    status_filter = request.query_params.get('status')
    if status_filter:
        transactions = transactions.filter(status=status_filter)

    serializer = TransactionSerializer(transactions, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def vendor_dashboard_stats(request):
    """
    Get dashboard statistics for vendor
    """
    vendor = request.user

    # Total transactions
    total_transactions = vendor.transactions.count()

    # Pending transactions
    pending_count = vendor.transactions.filter(status='pending').count()

    # Paid transactions
    paid_count = vendor.transactions.filter(status='paid').count()

    # Failed transactions
    failed_count = vendor.transactions.filter(status='failed').count()

    # Total revenue
    total_revenue = vendor.transactions.filter(status='paid').aggregate(
        total=Sum('amount')
    )['total'] or 0

    # Today's revenue
    today = timezone.now().date()
    today_revenue = vendor.transactions.filter(
        status='paid',
        paid_at__date=today
    ).aggregate(total=Sum('amount'))['total'] or 0

    # Recent transactions
    recent_transactions = vendor.transactions.all()[:5]

    return Response({
        'total_transactions': total_transactions,
        'pending_count': pending_count,
        'paid_count': paid_count,
        'failed_count': failed_count,
        'total_revenue': float(total_revenue),
        'today_revenue': float(today_revenue),
        'recent_transactions': TransactionSerializer(recent_transactions, many=True).data
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def transaction_detail(request, session_id):
    """
    Get details of a specific transaction
    """
    vendor = request.user

    try:
        transaction = Transaction.objects.get(session_id=session_id, vendor=vendor)
        return Response(TransactionSerializer(transaction).data)
    except Transaction.DoesNotExist:
        return Response(
            {'error': 'Transaction not found'},
            status=status.HTTP_404_NOT_FOUND
        )
```

**backend/vendors/urls.py**

```python
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Authentication
    path('register/', views.register_vendor, name='vendor_register'),
    path('login/', views.login_vendor, name='vendor_login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Profile
    path('profile/', views.vendor_profile, name='vendor_profile'),
    path('profile/update/', views.update_vendor_profile, name='update_vendor_profile'),

    # Transactions
    path('transactions/initiate/', views.initiate_transaction, name='initiate_transaction'),
    path('transactions/', views.vendor_transactions, name='vendor_transactions'),
    path('transactions/<str:session_id>/', views.transaction_detail, name='transaction_detail'),

    # Dashboard
    path('dashboard/stats/', views.vendor_dashboard_stats, name='dashboard_stats'),
]
```

**backend/vendors/admin.py**

```python
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Vendor, Transaction

@admin.register(Vendor)
class VendorAdmin(UserAdmin):
    list_display = ['email', 'username', 'business_name', 'is_verified', 'created_at']
    list_filter = ['is_verified', 'created_at']
    search_fields = ['email', 'username', 'business_name']
    ordering = ['-created_at']

    fieldsets = UserAdmin.fieldsets + (
        ('Vendor Info', {'fields': ('business_name', 'phone', 'is_verified', 'verification_token')}),
    )

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['session_id', 'vendor', 'amount', 'status', 'qr_generated', 'created_at']
    list_filter = ['status', 'qr_generated', 'created_at']
    search_fields = ['session_id', 'vendor__email', 'paystack_reference']
    readonly_fields = ['id', 'session_id', 'created_at', 'updated_at']
    ordering = ['-created_at']
```

**backend/payments/views.py**

```python
import hashlib
import hmac
import json
import requests
import qrcode
import io
import base64
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import PaymentSession
from .serializers import PaymentInitiateSerializer
import logging

logger = logging.getLogger(__name__)

@api_view(['POST'])
def generate_qr_code(request):
    """
    Generate a QR code for payment and register the session
    """
    serializer = PaymentInitiateSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # Extract validated data
    validated_data = serializer.validated_data
    session_id = validated_data['session_id']
    amount = validated_data['amount']
    vendor = validated_data['vendor']

    # Check if session already exists
    existing_session = PaymentSession.objects.filter(session_id=session_id).first()
    if existing_session:
        return Response(
            {"error": f"Session ID '{session_id}' already exists. Please use a unique session ID."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Create payment session
    payment_session = PaymentSession.objects.create(
        session_id=session_id,
        amount=amount,
        vendor=vendor,
        status='pending'
    )

    # Create QR code payload
    payload = {
        "session_id": session_id,
        "amount": float(amount),
        "vendor": vendor
    }
    qr_data = json.dumps(payload)

    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)

    # Create image
    img = qr.make_image(fill_color="black", back_color="white")

    # Convert to base64
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()

    logger.info(f"QR code generated for session: {session_id}")

    return Response({
        "session_id": session_id,
        "amount": str(amount),
        "vendor": vendor,
        "qr_code": f"data:image/png;base64,{img_str}",
        "message": "QR code generated and session registered successfully"
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
def initiate_payment(request):
    """
    Initiate a payment transaction with Paystack
    """
    serializer = PaymentInitiateSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # Extract validated data
    validated_data = serializer.validated_data
    session_id = validated_data['session_id']
    amount = validated_data['amount']
    vendor = validated_data['vendor']

    # Check if session already exists
    existing_session = PaymentSession.objects.filter(session_id=session_id).first()
    if existing_session and existing_session.status == 'paid':
        return Response(
            {"error": "This payment session has already been completed"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Create or update payment session
    payment_session, created = PaymentSession.objects.update_or_create(
        session_id=session_id,
        defaults={
            'amount': amount,
            'vendor': vendor,
            'status': 'pending'
        }
    )

    # Initialize Paystack transaction
    paystack_url = "https://api.paystack.co/transaction/initialize"
    headers = {
        "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "email": "test@example.com",
        "amount": int(amount * 100),  # Convert to kobo/cents
        "reference": f"{session_id}_{payment_session.id}",
        "callback_url": f"{settings.FRONTEND_URL}/payment-callback",
        "metadata": {
            "session_id": session_id,
            "vendor": vendor,
            "payment_session_id": str(payment_session.id)
        }
    }

    try:
        response = requests.post(paystack_url, json=payload, headers=headers)
        response_data = response.json()

        if response.status_code == 200 and response_data.get('status'):
            # Save Paystack reference
            payment_session.paystack_reference = response_data['data']['reference']
            payment_session.save()

            return Response({
                "reference": response_data['data']['reference'],
                "checkout_url": response_data['data']['authorization_url']
            }, status=status.HTTP_200_OK)
        else:
            logger.error(f"Paystack error: {response_data}")
            return Response(
                {"error": "Failed to initialize payment", "details": response_data},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    except requests.exceptions.RequestException as e:
        logger.error(f"Request error: {str(e)}")
        return Response(
            {"error": "Failed to connect to payment gateway"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@csrf_exempt
@api_view(['POST'])
def paystack_webhook(request):
    """
    Handle Paystack webhook events
    """
    # Verify webhook signature
    paystack_signature = request.META.get('HTTP_X_PAYSTACK_SIGNATURE')

    if not paystack_signature:
        logger.warning("Webhook received without signature")
        return JsonResponse({"error": "No signature provided"}, status=400)

    # Compute HMAC signature
    body = request.body
    hash_object = hmac.new(
        settings.PAYSTACK_SECRET_KEY.encode('utf-8'),
        body,
        hashlib.sha512
    )
    expected_signature = hash_object.hexdigest()

    if not hmac.compare_digest(expected_signature, paystack_signature):
        logger.warning("Invalid webhook signature")
        return JsonResponse({"error": "Invalid signature"}, status=400)

    # Parse event data
    try:
        event = json.loads(body.decode('utf-8'))
    except json.JSONDecodeError:
        logger.error("Invalid JSON in webhook")
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    event_type = event.get('event')
    data = event.get('data', {})
    reference = data.get('reference')

    if not reference:
        logger.warning("Webhook event missing reference")
        return JsonResponse({"error": "Missing reference"}, status=400)

    # Find payment session
    payment_session = PaymentSession.objects.filter(paystack_reference=reference).first()

    if not payment_session:
        logger.warning(f"Payment session not found for reference: {reference}")
        return JsonResponse({"error": "Payment session not found"}, status=404)

    # Update payment status based on event type
    if event_type == 'charge.success':
        payment_session.status = 'paid'
        logger.info(f"Payment successful for session: {payment_session.session_id}")

        # Also update vendor transaction if exists
        from vendors.models import Transaction
        try:
            transaction = Transaction.objects.get(session_id=payment_session.session_id)
            transaction.status = 'paid'
            transaction.paid_at = timezone.now()
            transaction.paystack_reference = reference
            transaction.save()
        except Transaction.DoesNotExist:
            pass

    elif event_type == 'charge.failed':
        payment_session.status = 'failed'
        logger.info(f"Payment failed for session: {payment_session.session_id}")

        # Also update vendor transaction if exists
        from vendors.models import Transaction
        try:
            transaction = Transaction.objects.get(session_id=payment_session.session_id)
            transaction.status = 'failed'
            transaction.save()
        except Transaction.DoesNotExist:
            pass

    payment_session.save()

    return JsonResponse({"status": "success"}, status=200)

@api_view(['GET'])
def payment_status(request, session_id):
    """
    Check payment status for a session
    """
    try:
        payment_session = PaymentSession.objects.get(session_id=session_id)
        return Response({
            "session_id": payment_session.session_id,
            "status": payment_session.status,
            "amount": str(payment_session.amount),
            "vendor": payment_session.vendor
        })
    except PaymentSession.DoesNotExist:
        return Response(
            {"error": "Payment session not found"},
            status=status.HTTP_404_NOT_FOUND
        )
```

### 7. URLs

**backend/payments/urls.py**

```python
from django.urls import path
from . import views

urlpatterns = [
    path('generate-qr/', views.generate_qr_code, name='generate_qr'),
    path('initiate/', views.initiate_payment, name='initiate_payment'),
    path('webhook/', views.paystack_webhook, name='paystack_webhook'),
    path('status/<str:session_id>/', views.payment_status, name='payment_status'),
]
```

**backend/qr_payment/urls.py**

```python
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/payments/', include('payments.urls')),
    path('api/vendors/', include('vendors.urls')),
]
```

---

## 🎨 Frontend Setup (React + Vite)

### 1. Package Configuration

**frontend/package.json**

```json
{
  "name": "qr-payment-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "html5-qrcode": "^2.3.8"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8"
  }
}
```

### 2. Vite Configuration

**frontend/vite.config.js**

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
```

### 3. Environment Configuration

**frontend/.env**

```env
VITE_API_URL=http://127.0.0.1:8000
```

### 4. Main Application

**frontend/src/main.jsx**

```javascript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 5. App Component

**frontend/src/App.jsx**

```jsx
import { useState, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {
  const [scanning, setScanning] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [generatedQR, setGeneratedQR] = useState(null);
  const [formData, setFormData] = useState({
    session_id: "",
    amount: "",
    vendor: "",
  });

  useEffect(() => {
    let scanner = null;

    if (scanning) {
      scanner = new Html5QrcodeScanner("qr-reader", {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      });

      scanner.render(onScanSuccess, onScanError);
    }

    return () => {
      if (scanner) {
        scanner
          .clear()
          .catch((err) => console.error("Error clearing scanner:", err));
      }
    };
  }, [scanning]);

  const onScanSuccess = (decodedText) => {
    try {
      const parsed = JSON.parse(decodedText);

      if (!parsed.session_id || !parsed.amount || !parsed.vendor) {
        setError("Invalid QR code format. Missing required fields.");
        return;
      }

      setQrData(parsed);
      setScanning(false);
      setError(null);
    } catch (e) {
      setError("Invalid QR code. Expected JSON format.");
    }
  };

  const onScanError = (err) => {
    // Ignore frequent scanning errors
    if (!err.includes("NotFoundException")) {
      console.warn("QR Scan error:", err);
    }
  };

  const handleFormChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const generateQRCode = async (e) => {
    e.preventDefault();

    if (!formData.session_id || !formData.amount || !formData.vendor) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/payments/generate-qr/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: formData.session_id,
          amount: parseFloat(formData.amount),
          vendor: formData.vendor,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedQR(data);
        setShowGenerateForm(false);
        setError(null);
        // Reset form
        setFormData({ session_id: "", amount: "", vendor: "" });
      } else {
        setError(data.error || "Failed to generate QR code");
      }
    } catch (err) {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const downloadQRCode = () => {
    if (!generatedQR) return;

    const link = document.createElement("a");
    link.href = generatedQR.qr_code;
    link.download = `qr_${generatedQR.session_id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const initiatePayment = async () => {
    if (!qrData) return;

    setLoading(true);
    setError(null);

    try {
      console.log("Initiating payment with:", qrData);
      console.log("API URL:", `${API_URL}/api/payments/initiate/`);

      const response = await fetch(`${API_URL}/api/payments/initiate/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(qrData),
      });

      console.log("Response status:", response.status);

      const data = await response.json();
      console.log("Response data:", data);

      if (response.ok) {
        // Redirect to Paystack checkout
        if (data.checkout_url) {
          console.log("Redirecting to:", data.checkout_url);
          window.location.href = data.checkout_url;
        } else {
          setError("No checkout URL received from server");
        }
      } else {
        const errorMessage =
          data.error ||
          data.details ||
          JSON.stringify(data) ||
          "Failed to initiate payment";
        console.error("Payment initiation failed:", errorMessage);
        setError(errorMessage);
      }
    } catch (err) {
      console.error("Payment error:", err);
      setError(`Network error: ${err.message}. Please check your connection.`);
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!qrData) return;

    try {
      console.log("Checking status for:", qrData.session_id);
      console.log(
        "Status URL:",
        `${API_URL}/api/payments/status/${qrData.session_id}/`
      );

      const response = await fetch(
        `${API_URL}/api/payments/status/${qrData.session_id}/`
      );

      console.log("Status response:", response.status);

      const data = await response.json();
      console.log("Status data:", data);

      if (response.ok) {
        setPaymentStatus(data);
        setError(null);
      } else {
        const errorMessage =
          data.error ||
          JSON.stringify(data) ||
          "Failed to fetch payment status";
        console.error("Status check failed:", errorMessage);
        setError(errorMessage);
      }
    } catch (err) {
      console.error("Status check error:", err);
      setError(`Network error while checking status: ${err.message}`);
    }
  };

  const resetScanner = () => {
    setQrData(null);
    setError(null);
    setPaymentStatus(null);
    setGeneratedQR(null);
    setScanning(true);
  };

  const resetAll = () => {
    setQrData(null);
    setError(null);
    setPaymentStatus(null);
    setGeneratedQR(null);
    setScanning(false);
    setShowGenerateForm(false);
  };

  return (
    <div className="app">
      <div className="container">
        <h1>QR Payment System</h1>

        {!scanning && !qrData && !showGenerateForm && !generatedQR && (
          <div className="button-group">
            <button
              className="btn btn-primary"
              onClick={() => setScanning(true)}
            >
              Scan QR Code
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowGenerateForm(true)}
            >
              Generate QR Code
            </button>
          </div>
        )}

        {showGenerateForm && (
          <div className="generate-form">
            <h2>Generate QR Code</h2>
            <form onSubmit={generateQRCode}>
              <div className="form-group">
                <label>Session ID</label>
                <input
                  type="text"
                  name="session_id"
                  value={formData.session_id}
                  onChange={handleFormChange}
                  placeholder="e.g., order_12345"
                  required
                />
              </div>
              <div className="form-group">
                <label>Amount (₦)</label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleFormChange}
                  placeholder="e.g., 500"
                  min="1"
                  step="0.01"
                  required
                />
              </div>
              <div className="form-group">
                <label>Vendor</label>
                <input
                  type="text"
                  name="vendor"
                  value={formData.vendor}
                  onChange={handleFormChange}
                  placeholder="e.g., Vendor_A"
                  required
                />
              </div>
              <div className="button-group">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? "Generating..." : "Generate QR Code"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowGenerateForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {generatedQR && (
          <div className="generated-qr">
            <h2>QR Code Generated!</h2>
            <div className="qr-display">
              <img src={generatedQR.qr_code} alt="Generated QR Code" />
            </div>
            <div className="qr-details">
              <div className="detail-row">
                <span>Session ID:</span>
                <strong>{generatedQR.session_id}</strong>
              </div>
              <div className="detail-row">
                <span>Amount:</span>
                <strong>₦{generatedQR.amount}</strong>
              </div>
              <div className="detail-row">
                <span>Vendor:</span>
                <strong>{generatedQR.vendor}</strong>
              </div>
            </div>
            <div className="button-group">
              <button className="btn btn-primary" onClick={downloadQRCode}>
                Download QR Code
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setScanning(true)}
              >
                Scan This QR
              </button>
              <button className="btn btn-secondary" onClick={resetAll}>
                Create Another
              </button>
            </div>
          </div>
        )}

        {scanning && (
          <div>
            <div id="qr-reader"></div>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setScanning(false);
                if (generatedQR) {
                  // Go back to showing generated QR
                } else {
                  resetAll();
                }
              }}
            >
              Cancel Scan
            </button>
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        {qrData && !scanning && (
          <div className="payment-details">
            <h2>Payment Details</h2>
            <div className="detail-row">
              <span>Session ID:</span>
              <strong>{qrData.session_id}</strong>
            </div>
            <div className="detail-row">
              <span>Amount:</span>
              <strong>₦{qrData.amount}</strong>
            </div>
            <div className="detail-row">
              <span>Vendor:</span>
              <strong>{qrData.vendor}</strong>
            </div>

            <div className="button-group">
              <button
                className="btn btn-primary"
                onClick={initiatePayment}
                disabled={loading}
              >
                {loading ? "Processing..." : "Pay Now"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={checkPaymentStatus}
              >
                Check Status
              </button>
              <button className="btn btn-secondary" onClick={resetScanner}>
                Scan New QR
              </button>
            </div>
          </div>
        )}

        {paymentStatus && (
          <div
            className={`alert ${
              paymentStatus.status === "paid" ? "alert-success" : "alert-info"
            }`}
          >
            <strong>Status:</strong> {paymentStatus.status.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
```

### 6. Styles

**frontend/src/components/VendorDashboard.jsx**

```jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function VendorDashboard({ handleLogout }) {
  const [vendor, setVendor] = useState(null);
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [generatedQR, setGeneratedQR] = useState(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("vendorToken");
    if (!token) {
      navigate("/vendor/login");
      return;
    }

    const vendorData = JSON.parse(localStorage.getItem("vendorData") || "{}");
    setVendor(vendorData);

    fetchDashboardStats();
    fetchTransactions();
  }, [navigate]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("vendorToken");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/vendors/dashboard/stats/`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else if (response.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/vendors/transactions/`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      } else if (response.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  };

  const generateQR = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/vendors/transactions/initiate/`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ amount: parseFloat(amount) }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setGeneratedQR(data);
        setAmount("");
        // Refresh stats and transactions
        fetchDashboardStats();
        fetchTransactions();
      } else {
        setError(data.error || "Failed to generate QR code");
      }
    } catch (err) {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    if (!generatedQR) return;

    const link = document.createElement("a");
    link.href = generatedQR.qr_code;
    link.download = `qr_${generatedQR.session_id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: "badge-warning",
      paid: "badge-success",
      failed: "badge-error",
    };
    return badges[status] || "badge-info";
  };

  if (!vendor) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Vendor Dashboard</h1>
          <p>Welcome, {vendor.business_name || vendor.email}</p>
        </div>
        <button className="btn btn-secondary" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="dashboard-tabs">
        <button
          className={`tab ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={`tab ${activeTab === "generate" ? "active" : ""}`}
          onClick={() => setActiveTab("generate")}
        >
          Generate QR
        </button>
        <button
          className={`tab ${activeTab === "transactions" ? "active" : ""}`}
          onClick={() => setActiveTab("transactions")}
        >
          Transactions
        </button>
      </div>

      {activeTab === "dashboard" && stats && (
        <div className="dashboard-content">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Transactions</h3>
              <p className="stat-value">{stats.total_transactions}</p>
            </div>
            <div className="stat-card">
              <h3>Total Revenue</h3>
              <p className="stat-value">
                ₦{stats.total_revenue.toLocaleString()}
              </p>
            </div>
            <div className="stat-card">
              <h3>Today's Revenue</h3>
              <p className="stat-value">
                ₦{stats.today_revenue.toLocaleString()}
              </p>
            </div>
            <div className="stat-card">
              <h3>Pending</h3>
              <p className="stat-value">{stats.pending_count}</p>
            </div>
            <div className="stat-card">
              <h3>Paid</h3>
              <p className="stat-value">{stats.paid_count}</p>
            </div>
            <div className="stat-card">
              <h3>Failed</h3>
              <p className="stat-value">{stats.failed_count}</p>
            </div>
          </div>

          {stats.recent_transactions &&
            stats.recent_transactions.length > 0 && (
              <div className="recent-transactions">
                <h2>Recent Transactions</h2>
                <div className="transactions-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Session ID</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recent_transactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td>{transaction.session_id}</td>
                          <td>
                            ₦{parseFloat(transaction.amount).toLocaleString()}
                          </td>
                          <td>
                            <span
                              className={`badge ${getStatusBadge(
                                transaction.status
                              )}`}
                            >
                              {transaction.status}
                            </span>
                          </td>
                          <td>
                            {new Date(
                              transaction.created_at
                            ).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </div>
      )}

      {activeTab === "generate" && (
        <div className="dashboard-content">
          {error && <div className="alert alert-error">{error}</div>}

          {!generatedQR ? (
            <div className="generate-section">
              <h2>Generate Payment QR Code</h2>
              <p>Enter the amount to create a QR code for customer payment</p>

              <form onSubmit={generateQR} className="generate-form">
                <div className="form-group">
                  <label>Amount (₦)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    min="1"
                    step="0.01"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? "Generating..." : "Generate QR Code"}
                </button>
              </form>
            </div>
          ) : (
            <div className="generated-qr">
              <div className="alert alert-success">
                ✅ QR Code Generated Successfully!
              </div>

              <div className="qr-display">
                <img src={generatedQR.qr_code} alt="Payment QR Code" />
              </div>

              <div className="qr-details">
                <div className="detail-row">
                  <span>Session ID:</span>
                  <strong>{generatedQR.session_id}</strong>
                </div>
                <div className="detail-row">
                  <span>Amount:</span>
                  <strong>
                    ₦{parseFloat(generatedQR.amount).toLocaleString()}
                  </strong>
                </div>
                <div className="detail-row">
                  <span>Status:</span>
                  <span className="badge badge-warning">Pending Payment</span>
                </div>
              </div>

              <div className="button-group">
                <button className="btn btn-primary" onClick={downloadQR}>
                  Download QR Code
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setGeneratedQR(null)}
                >
                  Generate Another
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="dashboard-content">
          <h2>All Transactions</h2>

          {transactions.length === 0 ? (
            <div className="empty-state">
              <p>No transactions yet. Generate a QR code to get started!</p>
            </div>
          ) : (
            <div className="transactions-table">
              <table>
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Paid At</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="session-id">{transaction.session_id}</td>
                      <td>
                        ₦{parseFloat(transaction.amount).toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={`badge ${getStatusBadge(
                            transaction.status
                          )}`}
                        >
                          {transaction.status}
                        </span>
                      </td>
                      <td>
                        {new Date(transaction.created_at).toLocaleString()}
                      </td>
                      <td>
                        {transaction.paid_at
                          ? new Date(transaction.paid_at).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default VendorDashboard;
```

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
    Ubuntu, Cantarell, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.app {
  width: 100%;
  max-width: 600px;
}

.container {
  background: white;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
  font-size: 28px;
}

h2 {
  color: #555;
  margin-bottom: 20px;
  font-size: 20px;
}

#qr-reader {
  margin: 20px 0;
  border-radius: 8px;
  overflow: hidden;
}

.btn {
  padding: 14px 28px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
  margin-top: 10px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5568d3;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.payment-details {
  margin-top: 30px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #eee;
}

.detail-row span {
  color: #666;
}

.detail-row strong {
  color: #333;
}

.button-group {
  margin-top: 30px;
}

.alert {
  padding: 16px;
  border-radius: 8px;
  margin-top: 20px;
  font-size: 14px;
}

.alert-error {
  background: #fee;
  color: #c33;
  border: 1px solid #fcc;
}

.alert-success {
  background: #efe;
  color: #3c3;
  border: 1px solid #cfc;
}

.alert-info {
  background: #eef;
  color: #33c;
  border: 1px solid #ccf;
}

.generate-form {
  margin-top: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-weight: 600;
  font-size: 14px;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s ease;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.generated-qr {
  margin-top: 20px;
  text-align: center;
}

.qr-display {
  background: #f8f9fa;
  padding: 30px;
  border-radius: 12px;
  margin: 20px 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.qr-display img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  background: white;
  padding: 10px;
}

.qr-details {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin: 20px 0;
}

.qr-details .detail-row {
  border-bottom: 1px solid #ddd;
}
```

---

## 🔨 Scripts

### QR Code Generator

**scripts/generate_qr.py**

```python
import qrcode
import json
import sys
import os
import requests
from datetime import datetime

def register_session_in_backend(session_id, amount, vendor, backend_url="http://127.0.0.1:8000"):
    """
    Pre-register the payment session in Django backend
    """
    url = f"{backend_url}/api/payments/initiate/"
    payload = {
        "session_id": session_id,
        "amount": amount,
        "vendor": vendor
    }

    print(f"\n🔄 Registering session in backend...")

    try:
        response = requests.post(url, json=payload, timeout=5)

        if response.status_code == 200:
            data = response.json()
            print(f"✅ Session registered successfully in backend")
            print(f"📝 Reference: {data.get('reference', 'N/A')}")
            return True
        else:
            print(f"⚠️  Backend returned status {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False

    except requests.exceptions.ConnectionError:
        print(f"❌ Could not connect to backend at {backend_url}")
        print(f"   Make sure Django is running: python manage.py runserver")
        return False
    except requests.exceptions.Timeout:
        print(f"⚠️  Backend request timed out")
        return False
    except Exception as e:
        print(f"❌ Error registering session: {str(e)}")
        return False

def generate_payment_qr(session_id, amount, vendor, output_dir="qr_codes", backend_url="http://127.0.0.1:8000", skip_backend=False):
    """
    Generate a QR code for payment with timestamp and session ID in filename
    Also pre-register the session in Django backend
    """
    payload = {
        "session_id": session_id,
        "amount": amount,
        "vendor": vendor
    }

    # Register session in backend first (unless skipped)
    if not skip_backend:
        backend_success = register_session_in_backend(session_id, amount, vendor, backend_url)
        if not backend_success:
            response = input("\n⚠️  Backend registration failed. Continue generating QR? (y/n): ")
            if response.lower() != 'y':
                print("❌ QR generation cancelled")
                return None

    # Convert to JSON string
    qr_data = json.dumps(payload)

    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"\n📁 Created directory: {output_dir}")

    # Generate filename with timestamp and session_id
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{output_dir}/qr_{session_id}_{timestamp}.png"

    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)

    # Create and save image
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(filename)

    print(f"\n✅ QR code generated successfully!")
    print(f"📁 Saved to: {filename}")
    print(f"📦 Payload: {qr_data}")
    print(f"💰 Amount: ₦{amount}")
    print(f"🏪 Vendor: {vendor}")
    print(f"🆔 Session ID: {session_id}")

    return filename

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python generate_qr.py <session_id> <amount> <vendor> [output_dir] [--skip-backend]")
        print("\nExamples:")
        print("  python generate_qr.py abc123 500 Vendor_A")
        print("  python generate_qr.py abc123 500 Vendor_A my_qr_codes")
        print("  python generate_qr.py abc123 500 Vendor_A qr_codes --skip-backend")
        print("\nOptions:")
        print("  --skip-backend: Generate QR without registering in backend")
        sys.exit(1)

    session_id = sys.argv[1]
    amount = int(sys.argv[2])
    vendor = sys.argv[3]

    # Parse optional arguments
    output_dir = "qr_codes"
    skip_backend = False

    for arg in sys.argv[4:]:
        if arg == "--skip-backend":
            skip_backend = True
        elif not arg.startswith("--"):
            output_dir = arg

    generate_payment_qr(session_id, amount, vendor, output_dir, skip_backend=skip_backend)
```

---

## 🚀 Setup Instructions

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies (including new ones for vendors app)
pip install -r requirements.txt

# Create .env file and add your Paystack keys
cp .env.example .env
# Edit .env with your actual keys

# IMPORTANT: Delete existing database (if any) since we're changing the user model
rm db.sqlite3
rm -rf */migrations/000*.py  # Keep __init__.py files

# Create migrations for all apps
python manage.py makemigrations vendors
python manage.py makemigrations payments
python manage.py migrate

# Create superuser (optional - this will be a Vendor account)
python manage.py createsuperuser

# Start Django server
python manage.py runserver
```

### 2. Setup Ngrok

```bash
# Install ngrok from https://ngrok.com/download

# Start ngrok tunnel
ngrok http 8000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update backend/.env with:
# NGROK_URL=https://abc123.ngrok.io

# Configure Paystack webhook:
# Go to Paystack Dashboard > Settings > Webhooks
# Set webhook URL to: https://abc123.ngrok.io/api/payments/webhook/
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start development server
npm run dev
```

### 4. Generate Test QR Codes

```bash
# Install qrcode library
pip install qrcode[pil]

# Generate QR code
python scripts/generate_qr.py abc123 500 Vendor_A
```

---

## 🧪 Testing with cURL

### Vendor Registration and Authentication

```bash
# Register a new vendor
curl -X POST http://127.0.0.1:8000/api/vendors/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vendor@test.com",
    "username": "testvendor",
    "password": "SecurePass123!",
    "password2": "SecurePass123!",
    "business_name": "Test Business",
    "phone": "+1234567890"
  }'

# Login
curl -X POST http://127.0.0.1:8000/api/vendors/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vendor@test.com",
    "password": "SecurePass123!"
  }'

# Save the access token from the response, then:

# Get Profile
curl -X GET http://127.0.0.1:8000/api/vendors/profile/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Initiate Transaction (Generate QR)
curl -X POST http://127.0.0.1:8000/api/vendors/transactions/initiate/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500
  }'

# Get All Transactions
curl -X GET http://127.0.0.1:8000/api/vendors/transactions/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get Dashboard Stats
curl -X GET http://127.0.0.1:8000/api/vendors/dashboard/stats/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Test Payment Initiation

```bash
curl -X POST http://127.0.0.1:8000/api/payments/initiate/ \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test_session_001",
    "amount": 500,
    "vendor": "Vendor_A"
  }'
```

### Test Payment Status

```bash
curl http://127.0.0.1:8000/api/payments/status/test_session_001/
```

### Test Webhook (Mock)

```bash
# This requires computing the HMAC signature
# Use Paystack's test tools or webhook testing services
curl -X POST http://127.0.0.1:8000/api/payments/webhook/ \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: YOUR_COMPUTED_SIGNATURE" \
  -d '{
    "event": "charge.success",
    "data": {
      "reference": "test_session_001_uuid",
      "status": "success"
    }
  }'
```

---

## 📝 Usage Flow

1. **Start Backend**: Run Django server on port 8000
2. **Start Ngrok**: Tunnel port 8000 and configure webhook
3. **Start Frontend**: Run React app on port 5173
4. **Generate QR**: Create test QR codes with payment data
5. **Scan QR**: Use frontend to scan QR code
6. **Initiate Payment**: Frontend sends payload to backend
7. **Pay**: User is redirected to Paystack checkout
8. **Webhook**: Paystack notifies backend of payment status
9. **Verify**: Check payment status in frontend

---

## 🔐 Security Notes

- Never commit `.env` files to version control
- Use test keys for development only
- Validate all webhook signatures
- Implement rate limiting in production
- Add authentication for sensitive endpoints
- Use HTTPS in production

---

## 📦 Additional Setup Files

### backend/.gitignore

```
*.pyc
__pycache__/
venv/
.env
db.sqlite3
*.log
```

### frontend/.gitignore

```
node_modules/
dist/
.env
.env.local
```

---

## 🐛 Troubleshooting

**CORS Issues**: Ensure `CORS_ALLOWED_ORIGINS` in Django settings matches your frontend URL

**Webhook Not Working**: Verify ngrok URL is active and webhook is configured in Paystack dashboard

**QR Scanner Not Starting**: Check browser permissions for camera access

**Payment Not Redirecting**: Verify `FRONTEND_URL` in backend `.env` matches your actual frontend URL

---

## 📋 Environment Templates

### backend/.env.example

```env
SECRET_KEY=your-django-secret-key-generate-new-one
DEBUG=True
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key_here
FRONTEND_URL=http://localhost:5173
NGROK_URL=https://your-ngrok-url.ngrok.io
```

### frontend/.env.example

```env
VITE_API_URL=http://127.0.0.1:8000
```

---

## 🎯 Complete File Listings

### Backend Files to Create

1. **backend/qr_payment/**init**.py** (empty file)
2. **backend/qr_payment/settings.py** (provided above)
3. **backend/qr_payment/urls.py** (provided above)
4. **backend/qr_payment/wsgi.py**

```python
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'qr_payment.settings')
application = get_wsgi_application()
```

5. **backend/qr_payment/asgi.py**

```python
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'qr_payment.settings')
application = get_asgi_application()
```

6. **backend/payments/**init**.py** (empty file)

7. **backend/payments/admin.py**

```python
from django.contrib import admin
from .models import PaymentSession

@admin.register(PaymentSession)
class PaymentSessionAdmin(admin.ModelAdmin):
    list_display = ['session_id', 'vendor', 'amount', 'status', 'created_at']
    list_filter = ['status', 'vendor', 'created_at']
    search_fields = ['session_id', 'vendor', 'paystack_reference']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-created_at']
```

8. **backend/payments/apps.py**

```python
from django.apps import AppConfig

class PaymentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'payments'
```

9. **backend/payments/models.py** (provided above)
10. **backend/payments/serializers.py** (provided above)
11. **backend/payments/views.py** (provided above)
12. **backend/payments/urls.py** (provided above)

13. **backend/manage.py**

```python
#!/usr/bin/env python
import os
import sys

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'qr_payment.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
```

---

### Frontend Files to Create

1. **frontend/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>QR Payment System</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

2. **frontend/src/main.jsx** (provided above)
3. **frontend/src/App.jsx** (provided above)
4. **frontend/src/index.css** (provided above)
5. **frontend/vite.config.js** (provided above)
6. **frontend/package.json** (provided above)

---

## 🔄 Payment Callback Handler

Add this component for handling payment callbacks:

**frontend/src/PaymentCallback.jsx**

```javascript
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Verifying payment...");

  useEffect(() => {
    const reference = searchParams.get("reference");

    if (reference) {
      // Extract session_id from reference (format: session_id_uuid)
      const sessionId = reference.split("_")[0];

      // Poll for payment status
      const checkStatus = async () => {
        try {
          const response = await fetch(
            `${API_URL}/api/payments/status/${sessionId}/`
          );
          const data = await response.json();

          if (data.status === "paid") {
            setStatus("success");
            setMessage("Payment successful! 🎉");
          } else if (data.status === "failed") {
            setStatus("failed");
            setMessage("Payment failed. Please try again.");
          } else {
            // Still pending, check again
            setTimeout(checkStatus, 2000);
          }
        } catch (err) {
          setStatus("error");
          setMessage("Error verifying payment. Please contact support.");
        }
      };

      checkStatus();
    } else {
      setStatus("error");
      setMessage("No payment reference found.");
    }
  }, [searchParams]);

  return (
    <div className="app">
      <div className="container">
        <h1>Payment Status</h1>
        <div
          className={`alert alert-${
            status === "success"
              ? "success"
              : status === "failed"
              ? "error"
              : "info"
          }`}
        >
          {message}
        </div>
        {status !== "processing" && (
          <button
            className="btn btn-primary"
            onClick={() => (window.location.href = "/")}
          >
            Return Home
          </button>
        )}
      </div>
    </div>
  );
}

export default PaymentCallback;
```

---

## 🧩 Additional Utility Functions

### Backend Utilities

**backend/payments/utils.py**

```python
import hashlib
import hmac
from django.conf import settings

def verify_paystack_signature(body: bytes, signature: str) -> bool:
    """
    Verify Paystack webhook signature
    """
    hash_object = hmac.new(
        settings.PAYSTACK_SECRET_KEY.encode('utf-8'),
        body,
        hashlib.sha512
    )
    expected_signature = hash_object.hexdigest()
    return hmac.compare_digest(expected_signature, signature)

def format_amount_for_paystack(amount: float) -> int:
    """
    Convert amount to kobo/cents (multiply by 100)
    """
    return int(amount * 100)

def format_amount_from_paystack(amount: int) -> float:
    """
    Convert amount from kobo/cents (divide by 100)
    """
    return amount / 100
```

---

## 📊 Database Migrations

After creating the models, run:

```bash
cd backend
python manage.py makemigrations payments
python manage.py migrate
```

This will create the initial migration file:

**backend/payments/migrations/0001_initial.py** (auto-generated)

---

## 🎨 Enhanced Frontend Features

### Add Loading Spinner

**frontend/src/components/Spinner.jsx**

```javascript
function Spinner() {
  return (
    <div
      style={{
        display: "inline-block",
        width: "20px",
        height: "20px",
        border: "3px solid rgba(255,255,255,.3)",
        borderRadius: "50%",
        borderTopColor: "#fff",
        animation: "spin 1s ease-in-out infinite",
      }}
    />
  );
}

export default Spinner;
```

Add to **frontend/src/index.css**:

```css
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

---

## 🔍 Testing Checklist

- [ ] Backend server starts without errors
- [ ] Frontend dev server starts without errors
- [ ] Ngrok tunnel is active
- [ ] Paystack webhook is configured
- [ ] QR code can be generated
- [ ] QR code scans successfully
- [ ] Payment initiation works
- [ ] Redirect to Paystack works
- [ ] Webhook receives events
- [ ] Payment status updates correctly
- [ ] Payment status can be checked

---

## 🚢 Production Deployment Checklist

- [ ] Set `DEBUG=False` in Django settings
- [ ] Use production database (PostgreSQL recommended)
- [ ] Set strong `SECRET_KEY`
- [ ] Use Paystack live keys
- [ ] Configure proper domain for webhooks
- [ ] Add SSL/TLS certificates
- [ ] Set up proper logging
- [ ] Implement rate limiting
- [ ] Add user authentication
- [ ] Configure CORS properly
- [ ] Set up monitoring and alerts
- [ ] Implement backup strategy
- [ ] Add comprehensive error handling

---

## 📚 API Documentation

### Vendor Endpoints

#### 1. Register Vendor

**POST** `/api/vendors/register/`

**Request Body:**

```json
{
  "email": "vendor@example.com",
  "username": "vendor123",
  "password": "SecurePass123!",
  "password2": "SecurePass123!",
  "business_name": "My Business",
  "phone": "+1234567890"
}
```

**Response (201 Created):**

```json
{
  "message": "Vendor registered successfully",
  "vendor": {
    "id": "uuid",
    "email": "vendor@example.com",
    "username": "vendor123",
    "business_name": "My Business",
    "is_verified": true
  },
  "tokens": {
    "refresh": "refresh_token_here",
    "access": "access_token_here"
  }
}
```

#### 2. Login Vendor

**POST** `/api/vendors/login/`

**Request Body:**

```json
{
  "email": "vendor@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**

```json
{
  "message": "Login successful",
  "vendor": {...},
  "tokens": {
    "refresh": "refresh_token_here",
    "access": "access_token_here"
  }
}
```

#### 3. Get Vendor Profile

**GET** `/api/vendors/profile/`

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response (200 OK):**

```json
{
  "id": "uuid",
  "email": "vendor@example.com",
  "username": "vendor123",
  "business_name": "My Business",
  "phone": "+1234567890",
  "is_verified": true,
  "created_at": "2025-01-20T10:30:00Z",
  "transaction_count": 15,
  "total_revenue": 7500.0
}
```

#### 4. Initiate Transaction (Generate QR)

**POST** `/api/vendors/transactions/initiate/`

**Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "amount": 500
}
```

**Response (201 Created):**

```json
{
  "transaction": {
    "id": "uuid",
    "vendor_email": "vendor@example.com",
    "session_id": "vendor_20250120153045123456",
    "amount": "500.00",
    "status": "pending",
    "qr_generated": true,
    "created_at": "2025-01-20T15:30:45Z"
  },
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAA...",
  "session_id": "vendor_20250120153045123456",
  "amount": "500.00",
  "message": "Transaction initiated successfully"
}
```

#### 5. Get All Transactions

**GET** `/api/vendors/transactions/`

**Headers:**

```
Authorization: Bearer <access_token>
```

**Query Parameters:**

- `status` (optional): Filter by status (pending, paid, failed)

**Response (200 OK):**

```json
[
  {
    "id": "uuid",
    "vendor_email": "vendor@example.com",
    "session_id": "vendor_20250120153045123456",
    "amount": "500.00",
    "status": "paid",
    "paid_at": "2025-01-20T15:35:00Z",
    "created_at": "2025-01-20T15:30:45Z"
  }
]
```

#### 6. Get Dashboard Statistics

**GET** `/api/vendors/dashboard/stats/`

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response (200 OK):**

```json
{
  "total_transactions": 15,
  "pending_count": 3,
  "paid_count": 10,
  "failed_count": 2,
  "total_revenue": 7500.00,
  "today_revenue": 1500.00,
  "recent_transactions": [...]
}
```

### Payment Endpoints

#### 1. Initiate Payment

**POST** `/api/payments/initiate/`

**Request Body:**

```json
{
  "session_id": "string",
  "amount": "number",
  "vendor": "string"
}
```

**Response (200 OK):**

```json
{
  "reference": "string",
  "checkout_url": "string"
}
```

**Error Response (400 Bad Request):**

```json
{
  "error": "string",
  "details": {}
}
```

#### 2. Payment Webhook

**POST** `/api/payments/webhook/`

**Headers:**

- `x-paystack-signature`: HMAC SHA512 signature

**Request Body:**

```json
{
  "event": "charge.success|charge.failed",
  "data": {
    "reference": "string",
    "amount": "number",
    "status": "string"
  }
}
```

**Response (200 OK):**

```json
{
  "status": "success"
}
```

#### 3. Check Payment Status

**GET** `/api/payments/status/<session_id>/`

**Response (200 OK):**

```json
{
  "session_id": "string",
  "status": "pending|paid|failed",
  "amount": "string",
  "vendor": "string"
}
```

---

## 🎓 Learning Resources

- **Django REST Framework**: https://www.django-rest-framework.org/
- **Paystack API Docs**: https://paystack.com/docs/api/
- **React Documentation**: https://react.dev/
- **Vite Guide**: https://vitejs.dev/guide/
- **QR Code Library**: https://github.com/mebjas/html5-qrcode

---

## 💡 Future Enhancements

1. **User Authentication**: Add Django auth and user-specific payments
2. **Payment History**: Store and display transaction history
3. **Multiple Payment Methods**: Support multiple gateways
4. **Receipt Generation**: Generate PDF receipts
5. **Email Notifications**: Send payment confirmations
6. **Analytics Dashboard**: Track payment metrics
7. **Refund System**: Implement payment refunds
8. **Multi-currency**: Support different currencies
9. **Mobile App**: Build native mobile apps
10. **Real-time Updates**: Use WebSockets for live status updates

---

## ⚠️ Important Notes

1. **Never expose secret keys** in frontend code
2. **Always validate** webhook signatures
3. **Use HTTPS** in production
4. **Implement proper logging** for debugging
5. **Test thoroughly** before going live
6. **Monitor webhook failures** and retry logic
7. **Keep dependencies updated** for security
8. **Follow PCI compliance** guidelines for payment data

---

## 🆘 Support & Troubleshooting

**Common Issues:**

1. **CORS errors**: Check `CORS_ALLOWED_ORIGINS` in settings.py
2. **Webhook signature fails**: Verify Paystack secret key
3. **QR scanner not working**: Enable camera permissions
4. **Payment redirect fails**: Check callback URL configuration
5. **Database errors**: Run migrations properly

**Getting Help:**

- Check Django logs: `python manage.py runserver`
- Check browser console for frontend errors
- Verify ngrok tunnel is active: `ngrok http 8000`
- Test webhooks with Paystack dashboard tools
- Review Paystack API logs in dashboard

---

## ✅ Quick Start Summary

```bash
# Terminal 1: Backend
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Terminal 2: Ngrok
ngrok http 8000

# Terminal 3: Frontend
cd frontend
npm install
npm run dev

# Terminal 4: Generate QR
python scripts/generate_qr.py test123 500 VendorA
```

**Access:**

- Frontend: http://localhost:5173
- Backend: http://127.0.0.1:8000
- Admin: http://127.0.0.1:8000/admin

---

**System is now ready for testing!** 🚀
