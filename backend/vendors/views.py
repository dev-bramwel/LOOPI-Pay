import uuid
import secrets
import qrcode
from qrcode.constants import ERROR_CORRECT_L
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
from django.contrib.auth import authenticate
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
        # If serializer.save() returned a list/tuple (e.g., [vendor]), unwrap it safely
        if isinstance(vendor, (list, tuple)):
            if vendor:
                vendor = vendor[0]
            else:
                return Response({'error': 'Failed to create vendor'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Generate verification token
        verification_token = secrets.token_urlsafe(32)
        setattr(vendor, 'verification_token', verification_token)
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
    email = request.data.get('email')
    password = request.data.get('password')

    if not email or not password:
        return Response({'error': 'Email and password are required'}, status=400)

    from django.contrib.auth import get_user_model
    user = get_user_model()
    #print("DEBUG: Users in DB")
    #for u in User.objects.all():
    #    print(u.email, u.username)


    user = authenticate(request, email=email, password=password)

    if user is None:
        return Response({'error': 'Invalid credentials'}, status=401)

    if not getattr(user, 'is_verified', False):
        return Response({'error': 'Please verify your email'}, status=403)

    from rest_framework_simplejwt.tokens import RefreshToken
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
    # raise_exception=True will cause DRF to return a 400 with errors automatically
    serializer.is_valid(raise_exception=True)

    vendor = request.user
    _validated = getattr(serializer, 'validated_data', None)
    validated = _validated if isinstance(_validated, dict) else {}
    amount = validated.get('amount')
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
        error_correction=ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    
    qr.add_data(qr_data)
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