import hashlib
import hmac
import json
import requests
import qrcode
from uuid import uuid4
from qrcode.constants import ERROR_CORRECT_L
import io
import base64
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from .models import PaymentSession, WebhookAudit
from .serializers import PaymentInitiateSerializer
import logging
from vendors.models import Vendor
from datetime import timedelta

logger = logging.getLogger(__name__)


def _attempt_paystack_cancel(payment_session):
    """Best-effort attempt to cancel/disable any stored authorization for a session.

    This checks the current Paystack transaction for the session's reference. If
    an authorization code is present, it attempts to disable that authorization
    via Paystack's `/authorization/disable` endpoint. Results are recorded in
    the session metadata under `cancel_attempt` for debugging.
    """
    try:
        ref = getattr(payment_session, 'paystack_reference', None)
        if not ref:
            return None

        verify_url = f"https://api.paystack.co/transaction/verify/{ref}"
        headers = {"Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}"}
        r = requests.get(verify_url, headers=headers, timeout=8)
        if r.status_code != 200:
            return None
        resp = r.json()
        auth = resp.get('data', {}).get('authorization') or {}
        auth_code = auth.get('authorization_code')
        if not auth_code:
            # nothing to disable
            return None

        disable_url = "https://api.paystack.co/authorization/disable"
        payload = {"authorization_code": auth_code}
        dr = requests.post(disable_url, json=payload, headers=headers, timeout=8)
        try:
            dr_data = dr.json()
        except Exception:
            dr_data = {"status_code": dr.status_code}

        # persist cancel attempt info in metadata
        meta = getattr(payment_session, 'metadata', None) or {}
        meta['cancel_attempt'] = {
            'time': timezone.now().isoformat(),
            'authorization_code': auth_code,
            'response': dr_data,
        }
        PaymentSession.objects.filter(pk=payment_session.pk).update(metadata=meta)
        payment_session.refresh_from_db()
        logger.info("Attempted Paystack cancel for session %s, auth=%s, result=%s", payment_session.session_id, auth_code, dr_data)
        return dr_data
    except Exception as e:
        logger.warning("Error attempting paystack cancel for session %s: %s", getattr(payment_session, 'session_id', None), e)
        return None

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_qr_code(request):
    """
    Generate a QR code for payment and register the session
    """
    
    serializer = PaymentInitiateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    validated_data = getattr(serializer, 'validated_data', {}) or {}
    session_id = validated_data.get('session_id')
    amount = validated_data.get('amount')

    # Use authenticated user as vendor
    vendor_instance = request.user

    if not isinstance(vendor_instance, Vendor):
        return Response({"error": "Authenticated user is not a vendor"}, status=400)

    # Prevent duplicate session IDs
    if PaymentSession.objects.filter(session_id=session_id).exists():
        return Response(
            {"error": f"Session ID '{session_id}' already exists."},
            status=status.HTTP_400_BAD_REQUEST
        )

    payment_session = PaymentSession.objects.create(
        session_id=session_id,
        amount=amount,
        vendor=vendor_instance,
        status='pending'
    )

    # Create QR code payload (ensure amount is not None and convertible to float)
    try:
        amount_float = float(amount) if amount is not None else None
    except (TypeError, ValueError):
        return Response({"error": "Invalid amount provided"}, status=status.HTTP_400_BAD_REQUEST)

    if amount_float is None:
        return Response({"error": "Missing amount"}, status=status.HTTP_400_BAD_REQUEST)

    # Use a frontend redirect URL so scanning the QR opens the frontend which
    # will initiate the Paystack checkout and redirect the customer.
    frontend_base = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    redirect_url = f"{frontend_base.rstrip('/')}/pay?session_id={session_id}"

    qr = qrcode.QRCode(version=1, error_correction=ERROR_CORRECT_L, box_size=10, border=4)
    qr.add_data(redirect_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, "PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()

    logger.info(f"QR code generated for session: {session_id}")

    return Response({
        "session_id": session_id,
        "amount": str(amount),
        "vendor": vendor_instance.email,
        "qr_code": f"data:image/png;base64,{img_str}",
        "message": "QR code generated and session registered successfully"
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def initiate_payment(request):
    """
    Initiate a payment transaction with Paystack
    """
    serializer = PaymentInitiateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    validated_data = getattr(serializer, 'validated_data', {}) or {}
    session_id = validated_data.get('session_id')
    amount = validated_data.get('amount')

    # Use authenticated user as vendor
    vendor_instance = request.user
    if not isinstance(vendor_instance, Vendor):
        return Response({"error": "Authenticated user is not a vendor"}, status=400)

    # Prevent duplicate paid sessions
    existing_session = PaymentSession.objects.filter(session_id=session_id, status='paid').first()
    if existing_session:
        return Response(
            {"error": "This payment session has already been completed"},
            status=status.HTTP_400_BAD_REQUEST
        )

    payment_session = PaymentSession.objects.filter(session_id=session_id).first()
    if not payment_session:
        return Response({"error": "Session not registered"}, status=400)

    # Initialize Paystack transaction
    paystack_url = "https://api.paystack.co/transaction/initialize"
    headers = {
        "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json"
    }

    # Validate and convert amount to float, then to kobo/cents for Paystack
    if amount is None:
        return Response({"error": "Missing amount"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        amount_float = float(amount)
    except (TypeError, ValueError):
        return Response({"error": "Invalid amount provided"}, status=status.HTTP_400_BAD_REQUEST)

    amount_cents = int(amount_float * 100)  # convert to kobo/cents

    payload = {
        "email": vendor_instance.email,
        "amount": amount_cents,
        "reference": f"{session_id}_{payment_session.id}",
        "callback_url": f"{settings.FRONTEND_URL}/payment-callback",
        "metadata": {
            "session_id": session_id,
            "vendor": vendor_instance.email,
            "payment_session_id": str(payment_session.id)
        }
    }

    try:
        response = requests.post(paystack_url, json=payload, headers=headers)
        response_data = response.json()

        if response.status_code == 200 and response_data.get('status'):
            payment_session.paystack_reference = response_data['data']['reference']
            payment_session.save()

            return Response({
                "reference": response_data['data']['reference'],
                "checkout_url": response_data['data']['authorization_url'],
                "session_id": payment_session.session_id
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


@api_view(['GET'])
@permission_classes([AllowAny])
def initiate_payment_public(request):
    """
    Public initiate endpoint for customers scanning a QR code.
    Finds the PaymentSession by `session_id` query param, uses the stored
    vendor and amount, initializes a Paystack transaction and returns the
    `checkout_url` and `reference`.
    """
    session_id = request.query_params.get('session_id')
    if not session_id:
        return Response({"error": "Missing session_id"}, status=400)

    payment_session = PaymentSession.objects.filter(session_id=session_id).first()
    if not payment_session:
        return Response({"error": "Payment session not found"}, status=404)

    # Use stored vendor and amount
    vendor_instance = payment_session.vendor
    amount = payment_session.amount

    # Ensure vendor and vendor email exist to avoid attribute access on None
    vendor_email = getattr(vendor_instance, 'email', None)
    if not vendor_email:
        return Response({"error": "Vendor not associated with payment session"}, status=400)

    # Prepare Paystack init (same logic as authenticated initiate)
    paystack_url = "https://api.paystack.co/transaction/initialize"
    headers = {
        "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json"
    }
    try:
        amount_float = float(amount)
    except (TypeError, ValueError):
        return Response({"error": "Invalid amount on session"}, status=400)

    amount_cents = int(amount_float * 100)

    # If we already have an existing Paystack reference, try to verify it and
    # reuse the stored authorization_url if still valid. This prevents
    # 'Duplicate Transaction Reference' errors when public-initiate is called
    # multiple times for the same session.
    try:
        existing_ref = payment_session.paystack_reference
        if existing_ref:
            # try verify
            try:
                verify_url = f"https://api.paystack.co/transaction/verify/{existing_ref}"
                vr = requests.get(verify_url, headers={"Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}"}, timeout=5)
                if vr.status_code == 200:
                    vdata = vr.json()
                    if vdata.get('status') and vdata.get('data', {}).get('status') in ('pending', 'success'):
                        # reuse previous authorization_url if available in metadata
                        meta = getattr(payment_session, 'metadata', None) or {}
                        auth_url = meta.get('authorization_url')
                        if auth_url:
                            return Response({
                                "reference": existing_ref,
                                "checkout_url": auth_url,
                                "session_id": payment_session.session_id
                            }, status=status.HTTP_200_OK)
            except requests.RequestException:
                # network issues verifying - fall through and attempt to init anew
                pass

        # Build a unique reference to avoid duplicates
        unique_ref = f"{session_id}_{payment_session.id}_{uuid4().hex[:8]}"

        payload = {
            "email": vendor_email,
            "amount": amount_cents,
            "reference": unique_ref,
            "callback_url": f"{settings.FRONTEND_URL.rstrip('/')}/payment-callback",
            "metadata": {
                "session_id": session_id,
                "vendor": vendor_email,
                "payment_session_id": str(payment_session.id)
            }
        }

        response = requests.post(paystack_url, json=payload, headers=headers)
        response_data = response.json()

        # Handle duplicate_reference by retrying with a new random suffix once
        if response.status_code != 200 or not response_data.get('status'):
            # If validation error duplicate_reference, try again once
            err_code = response_data.get('code') or response_data.get('data', {}).get('code')
            if err_code == 'duplicate_reference' or ('Duplicate Transaction Reference' in str(response_data.get('message', ''))):
                unique_ref = f"{session_id}_{payment_session.id}_{uuid4().hex[:8]}"
                payload['reference'] = unique_ref
                response = requests.post(paystack_url, json=payload, headers=headers)
                response_data = response.json()

        if response.status_code == 200 and response_data.get('status'):
            ref = response_data['data']['reference']
            auth_url = response_data['data'].get('authorization_url')
            payment_session.paystack_reference = ref
            # persist authorization_url in metadata for reuse
            meta = getattr(payment_session, 'metadata', None) or {}
            meta['authorization_url'] = auth_url
            # Use QuerySet.update to avoid descriptor/type issues when assigning directly
            PaymentSession.objects.filter(pk=payment_session.pk).update(paystack_reference=ref, metadata=meta)
            payment_session.refresh_from_db()

            return Response({
                "reference": ref,
                "checkout_url": auth_url,
                "session_id": payment_session.session_id
            }, status=status.HTTP_200_OK)
        else:
            logger.error(f"Paystack error (public init): {response_data}")
            return Response({"error": "Failed to initialize payment", "details": response_data}, status=500)
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error (public init): {str(e)}")
        return Response({"error": "Failed to connect to payment gateway"}, status=500)

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def paystack_webhook(request):
    """
    Handle Paystack webhook events
    """
    # log incoming requests
    logger.info("Webhook received. Headers=%s Body=%s", dict(request.headers), request.body.decode())

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
        # Log more context to help debugging signature issues (do NOT log secret)
        body_snip = request.body.decode('utf-8', errors='replace')[:1000]
        logger.warning(
            "Invalid webhook signature. Received=%s; Headers=%s; Body(start)=%s",
            paystack_signature,
            dict(request.headers),
            body_snip,
        )
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

    # Create an audit record for this webhook (payload and headers)
    try:
        # Ensure headers are JSON-serializable by stringifying values
        incoming_headers = dict(request.headers)
        safe_headers = {k: str(v) for k, v in incoming_headers.items()}
        # payload is already a parsed JSON dict (event)
        safe_payload = event
        audit = WebhookAudit.objects.create(
            event=event_type,
            reference=reference,
            payload=safe_payload,
            headers=safe_headers,
            processed=False,
        )
    except Exception as e:
        logger.exception("Failed to create WebhookAudit record: %s", e)
        audit = None

    if not reference:
        logger.warning("Webhook event missing reference")
        return JsonResponse({"error": "Missing reference"}, status=400)

    # Find payment session by reference
    payment_session = PaymentSession.objects.filter(paystack_reference=reference).first()

    # Fallback: if not found by reference, try mapping via metadata.session_id
    if not payment_session:
        logger.info("No PaymentSession matched by paystack_reference=%s, attempting metadata lookup", reference)
        md = data.get('metadata', {}) or {}
        sid = md.get('session_id')
        if sid:
            payment_session = PaymentSession.objects.filter(session_id=sid).first()
            if payment_session:
                logger.info("Resolved PaymentSession by metadata.session_id=%s -> %s", sid, payment_session.pk)

    # Last-resort: verify the reference with Paystack and try to extract metadata.session_id
    if not payment_session:
        try:
            verify_url = f"https://api.paystack.co/transaction/verify/{reference}"
            headers = {"Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}"}
            vr = requests.get(verify_url, headers=headers, timeout=8)
            if vr.status_code == 200:
                vdata = vr.json()
                vmd = vdata.get('data', {}).get('metadata', {}) or {}
                vsid = vmd.get('session_id')
                if vsid:
                    payment_session = PaymentSession.objects.filter(session_id=vsid).first()
                    if payment_session:
                        logger.info("Resolved PaymentSession by Paystack verify metadata.session_id=%s -> %s", vsid, payment_session.pk)
        except requests.RequestException as e:
            logger.warning("Error verifying reference with Paystack while resolving session: %s", e)

    if not payment_session:
        logger.warning(f"Payment session not found for reference: {reference}")
        if audit:
            audit.result = "session_not_found_by_reference"
            audit.save()
        return JsonResponse({"error": "Payment session not found"}, status=404)

    # If this session was auto-failed by the app (customer timed out), ignore
    # incoming webhook events for it to avoid flipping state after cancellation.
    meta = getattr(payment_session, 'metadata', None) or {}
    if meta.get('auto_failed') or payment_session.status == PaymentSession.STATUS_FAILED:
        logger.info(f"Ignoring webhook for auto-failed session: {payment_session.session_id}")
        return JsonResponse({"status": "ignored", "reason": "session auto-failed"}, status=200)

    # Update payment status based on event type
    if event_type == 'charge.success':
        payment_session.status = PaymentSession.STATUS_COMPLETED
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

    if audit:
        audit.processed = True
        audit.result = f"processed:event={event_type},session={payment_session.session_id}"
        try:
            audit.save()
        except Exception as e:
            logger.exception("Failed to save WebhookAudit processed state: %s", e)

    return JsonResponse({"status": "success"}, status=200)

@api_view(['GET'])
@permission_classes([AllowAny])
def payment_status(request, session_id):
    """
    Check payment status for a session
    """
    # Resolve session by session_id if possible
    try:
        payment_session = PaymentSession.objects.get(session_id=session_id)
    except PaymentSession.DoesNotExist:
        payment_session = None

    # If not found by session_id, and a Paystack reference was provided, try other resolution strategies
    reference = request.query_params.get('reference')
    if not payment_session and reference:
        # 1) Try matching stored paystack_reference
        payment_session = PaymentSession.objects.filter(paystack_reference=reference).first()

        # 2) If still not found, verify the reference with Paystack and try to map via metadata
        if not payment_session:
            try:
                verify_url = f"https://api.paystack.co/transaction/verify/{reference}"
                headers = {"Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}"}
                r = requests.get(verify_url, headers=headers, timeout=10)
                if r.status_code == 200:
                    resp = r.json()
                    if resp.get('status'):
                        md = resp.get('data', {}).get('metadata', {}) or {}
                        sid = md.get('session_id')
                        if sid:
                            payment_session = PaymentSession.objects.filter(session_id=sid).first()
                        else:
                            vendor_email = md.get('vendor') or resp.get('data', {}).get('customer', {}).get('email')
                            if vendor_email:
                                # Paystack amount is in kobo/cents
                                try:
                                    amount_val = resp.get('data', {}).get('amount', 0)
                                    amt = amount_val / 100
                                except Exception:
                                    amt = None
                                if amt is not None:
                                    payment_session = PaymentSession.objects.filter(vendor__email=vendor_email, amount=amt).first()

                        # If verification shows success, update session and transaction
                        if payment_session and resp.get('data', {}).get('status') == 'success':
                            payment_session.status = PaymentSession.STATUS_COMPLETED
                            payment_session.paystack_reference = reference
                            payment_session.save()
                            try:
                                from vendors.models import Transaction
                                try:
                                    transaction = Transaction.objects.get(session_id=payment_session.session_id)
                                except Transaction.DoesNotExist:
                                    transaction = Transaction.objects.get(session_id=str(payment_session.id))
                                transaction.status = 'paid'
                                transaction.paid_at = timezone.now()
                                transaction.paystack_reference = reference
                                transaction.save()
                            except Exception:
                                pass
            except requests.RequestException:
                # network issue verifying — ignore and return current status
                pass

    if not payment_session:
        return Response({"error": "Payment session not found"}, status=status.HTTP_404_NOT_FOUND)

    # Auto-fail sessions older than configured minutes that are still pending.
    # Set `PAYMENT_AUTO_FAIL_MINUTES=0` to disable this behavior for testing.
    auto_fail_minutes = getattr(settings, 'PAYMENT_AUTO_FAIL_MINUTES', 0)
    if payment_session.status == PaymentSession.STATUS_PENDING and auto_fail_minutes and auto_fail_minutes > 0:
        age = timezone.now() - payment_session.created_at
        if age > timedelta(minutes=auto_fail_minutes):
            # Mark session failed due to timeout and record the auto-fail
            meta = getattr(payment_session, 'metadata', None) or {}
            meta['auto_failed'] = True
            # persist using update to avoid field type issues
            PaymentSession.objects.filter(pk=payment_session.pk).update(status=PaymentSession.STATUS_FAILED, metadata=meta)
            payment_session.refresh_from_db()

            # Also update vendor Transaction if it exists
            try:
                from vendors.models import Transaction
                # try matching by session_id string first
                try:
                    transaction = Transaction.objects.get(session_id=payment_session.session_id)
                except Transaction.DoesNotExist:
                    # fallback: some code may have stored PaymentSession.id in transaction.session_id
                    transaction = Transaction.objects.get(session_id=str(payment_session.id))

                transaction.status = 'failed'
                transaction.save()
            except Exception:
                # no transaction found or other error - ignore silently
                pass
            # Best-effort: try to cancel/disable any Paystack authorization for this session
            try:
                _attempt_paystack_cancel(payment_session)
            except Exception:
                pass

    # Add a hint header to let clients stop polling immediately when session is final
    resp = Response({
        "session_id": payment_session.session_id,
        "status": payment_session.status,
        "amount": str(payment_session.amount),
        "vendor": payment_session.vendor.email if payment_session.vendor else None
    })
    if payment_session.status in (PaymentSession.STATUS_COMPLETED, PaymentSession.STATUS_FAILED):
        resp['X-Payment-Final'] = '1'
    return resp


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_payment(request):
    """
    Cancel a payment session (vendor-initiated). Marks session as failed and
    records `metadata.auto_failed = True`. Only the vendor who owns the
    session (or staff) may cancel.
    Expects JSON body: { "session_id": "..." }
    """
    data = getattr(request, 'data', {}) or {}
    session_id = data.get('session_id')
    if not session_id:
        return Response({"error": "Missing session_id"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        payment_session = PaymentSession.objects.get(session_id=session_id)
    except PaymentSession.DoesNotExist:
        return Response({"error": "Payment session not found"}, status=status.HTTP_404_NOT_FOUND)

    # Only the owning vendor (or staff) can cancel
    user = request.user
    if not (user.is_staff or (payment_session.vendor and payment_session.vendor == user)):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

    # If already completed, do not cancel
    if payment_session.status == PaymentSession.STATUS_COMPLETED:
        return Response({"error": "Cannot cancel a completed payment"}, status=status.HTTP_400_BAD_REQUEST)

    # Mark as failed and flag auto_failed
    meta = getattr(payment_session, 'metadata', None) or {}
    meta['auto_failed'] = True
    PaymentSession.objects.filter(pk=payment_session.pk).update(status=PaymentSession.STATUS_FAILED, metadata=meta)
    payment_session.refresh_from_db()

    # update vendor Transaction if present
    try:
        from vendors.models import Transaction
        try:
            transaction = Transaction.objects.get(session_id=payment_session.session_id)
        except Transaction.DoesNotExist:
            transaction = Transaction.objects.filter(session_id=str(payment_session.id)).first()
        if transaction:
            transaction.status = 'failed'
            transaction.save()
    except Exception:
        # ignore errors updating transactions
        pass

    # Best-effort: try to cancel/disable any Paystack authorization for this session
    try:
        _attempt_paystack_cancel(payment_session)
    except Exception:
        pass

    return Response({"status": "cancelled", "session_id": payment_session.session_id}, status=status.HTTP_200_OK)