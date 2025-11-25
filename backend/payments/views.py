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