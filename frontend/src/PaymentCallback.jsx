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
      // First try to resolve session_id from a mapping stored before redirect.
      // PayRedirect stores `pay_ref:<reference> => session_id` in localStorage.
      let sessionId = null;
      try {
        sessionId = localStorage.getItem(`pay_ref:${reference}`);
      } catch (e) {
        // ignore storage access errors
      }

      // Fallback: try to parse the session_id out of the reference string.
      // Reference formats may be:
      //  - {session_id}_{payment_session.id}
      //  - {session_id}_{payment_session.id}_{uuid}
      // We remove the trailing `_numericId` and optional `_uuid` suffix.
      if (!sessionId) {
        const m = reference.match(/^(.+?)_\d+(?:_[0-9a-fA-F-]+)?$/);
        if (m) {
          sessionId = m[1];
        }
      }

      if (!sessionId) {
        setStatus("error");
        setMessage("Could not determine payment session from reference.");
        return;
      }

      // Poll for payment status
      const checkStatus = async () => {
        try {
          const response = await fetch(
            `${API_URL}/api/payments/status/${sessionId}/?reference=${encodeURIComponent(
              reference
            )}`
          );
          const data = await response.json();

          // Normalize possible backend statuses (e.g., 'paid' or 'completed')
          const s = (data.status || "").toString().toLowerCase();

          if (s === "paid" || s === "completed") {
            setStatus("success");
            setMessage(
              "Payment complete — thank you! A receipt will be sent shortly."
            );
          } else if (s === "failed") {
            setStatus("failed");
            setMessage("Payment failed. Please try again or contact support.");
          } else if (s === "pending" || s === "processing" || s === "open") {
            // Still pending, check again after a longer interval to reduce noise
            setTimeout(checkStatus, 6000);
          } else {
            // Unknown state: surface an error
            setStatus("error");
            setMessage("Error verifying payment. Please contact support.");
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
    <>
      <h2>Payment Status</h2>
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
    </>
  );
}

export default PaymentCallback;
