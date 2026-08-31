import qrcode
import json
import sys
import os
import requests
from datetime import datetime
from qrcode.constants import ERROR_CORRECT_L


def register_session_in_backend(
    session_id, amount, vendor, backend_url="http://localhost"
):
    """
    Pre-register the payment session in Django backend
    """
    url = f"{backend_url}/api/payments/initiate/"
    payload = {"session_id": session_id, "amount": amount, "vendor": vendor}

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


def generate_payment_qr(
    session_id,
    amount,
    vendor,
    output_dir="qr_codes",
    backend_url="http://localhost",
    skip_backend=False,
):
    """
    Generate a QR code for payment with timestamp and session ID in filename
    Also pre-register the session in Django backend
    """
    payload = {"session_id": session_id, "amount": amount, "vendor": vendor}

    # Register session in backend first (unless skipped)
    if not skip_backend:
        backend_success = register_session_in_backend(
            session_id, amount, vendor, backend_url
        )
        if not backend_success:
            response = input(
                "\n⚠️  Backend registration failed. Continue generating QR? (y/n): "
            )
            if response.lower() != "y":
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

    qr = qrcode.QRCode(
        version=1,
        error_correction=ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )

    qr.add_data(qr_data)
    qr.make(fit=True)

    # Create and save image
    img = qr.make_image(fill_color="black", back_color="white")
    # Open the output file in binary mode and write the image to the stream to satisfy type checkers
    with open(filename, "wb") as f:
        img.save(f, "PNG")

    print(f"\n✅ QR code generated successfully!")
    print(f"📁 Saved to: {filename}")
    print(f"📦 Payload: {qr_data}")
    print(f"💰 Amount: KES {amount}")
    print(f"🏪 Vendor: {vendor}")
    print(f"🆔 Session ID: {session_id}")

    return filename


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python generate_qr.py    [output_dir] [--skip-backend]")
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

    generate_payment_qr(
        session_id, amount, vendor, output_dir, skip_backend=skip_backend
    )
