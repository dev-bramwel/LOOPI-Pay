import uuid
import secrets
import qrcode
from qrcode.constants import ERROR_CORRECT_L
import io
import base64
import json
from datetime import datetime
from django.contrib.auth import get_user_model, authenticate
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Vendor, Transaction
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes
from django.utils.encoding import force_bytes
from django.core.mail import send_mail
from django.conf import settings
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
    serializer = VendorRegistrationSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    saved = serializer.save()

    # Ensure we have a Vendor instance (serializer may return an instance or a list)
    if isinstance(saved, list):
        vendor = saved[0] if saved else None
    else:
        vendor = saved

    if vendor is None:
        return Response({'error': 'Failed to create vendor'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Create verification token
    verification_token = secrets.token_urlsafe(32)
    vendor.verification_token = verification_token
    vendor.is_verified = False
    vendor.save()

    # Build verification URL (include uid so verify endpoint can locate the vendor)
    base_url = request.build_absolute_uri('/')[:-1]
    verification_uid = urlsafe_base64_encode(force_bytes(vendor.pk))
    verification_url = f"{base_url}/api/vendors/verify-email/?token={verification_token}&uid={verification_uid}"

    # Send verification email
    subject = "Verify your vendor account"
    message = f"Click the link to verify your account: {verification_url}"
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [vendor.email])

    # Do NOT issue tokens at registration time — require email verification first.
    return Response({
        "message": "Vendor registered successfully. Please check your email to verify your account.",
        "vendor": VendorSerializer(vendor).data
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
def verify_email(request):
    token = request.GET.get('token')

    if not token:
        return Response({"error": "Token missing"}, status=400)

    try:
        vendor = Vendor.objects.get(verification_token=token)
    except Vendor.DoesNotExist:
        return Response({"error": "Invalid token"}, status=400)

    vendor.is_verified = True
    vendor.verification_token = None
    vendor.save()

    # Issue tokens on successful verification so the user can be logged in automatically
    refresh = RefreshToken.for_user(vendor)

    return Response({
        "message": "Email verified successfully!",
        "vendor": VendorSerializer(vendor).data,
        "tokens": {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def login_vendor(request):
    email = request.data.get('email')
    password = request.data.get('password')

    if not email or not password:
        return Response({'error': 'Email and password are required'}, status=400)

    # authenticate using the project's USERNAME_FIELD (your Vendor model uses email)
    user = authenticate(username=email, password=password)

    if user is None:
        return Response({'error': 'Invalid credentials'}, status=401)

    if not getattr(user, 'is_verified', False):
        return Response({'error': 'Please verify your email'}, status=403)

    refresh = RefreshToken.for_user(user)
    return Response({
        'message': 'Login successful',
        'vendor': VendorSerializer(user).data,
        'tokens': {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
    })

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
    serializer.is_valid(raise_exception=True)

    vendor = request.user
    validated_data = getattr(serializer, 'validated_data', {}) or {}
    amount = validated_data.get('amount')
    if amount is None:
        return Response({'error': 'Amount is required'}, status=status.HTTP_400_BAD_REQUEST)

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
        vendor=vendor,
        status='pending'
    )

    # Generate QR code payload that redirects to frontend /pay route
    frontend_base = getattr(settings, 'FRONTEND_URL', None) or request.build_absolute_uri('/').rstrip('/')
    redirect_url = f"{frontend_base}/pay?session_id={session_id}"
    qr = qrcode.QRCode(
        version=1,
        error_correction=ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )

    qr.add_data(redirect_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, "PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()

    logger.info(f"Transaction initiated by {vendor.email}: {session_id}")

    return Response({
        'transaction': TransactionSerializer(transaction).data,
        'qr_code': f"data:image/png;base64,{img_str}",
        'session_id': session_id,
        'amount': str(amount),
        'created_at': payment_session.created_at.isoformat(),
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