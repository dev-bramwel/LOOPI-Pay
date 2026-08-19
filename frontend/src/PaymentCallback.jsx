import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Verifying payment...");
  const shownRef = useRef(false);
  useEffect(() => {
    const reference =
      searchParams.get("reference") || searchParams.get("trxref");
    let timeoutHandle = null;

    if (reference) {
      // First try to resolve session_id from a mapping stored before redirect.
      // PayRedirect stores `pay_ref:<reference> => session_id` in localStorage.
      let sessionId = null;
      try {
        sessionId = localStorage.getItem(`pay_ref:${reference}`);
      } catch (e) {
        // ignore storage access errors
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
          // If server signals final state via header, stop further polling
          const isFinal = response.headers.get("x-payment-final");
          const data = await response.json();

          // Normalize possible backend statuses (e.g., 'paid' or 'completed')
          const s = (data.status || "").toString().toLowerCase();

          if (s === "paid" || s === "completed") {
            if (!shownRef.current) {
              shownRef.current = true;
              setStatus("success");
              setMessage(
                "Payment complete — thank you! A receipt will be sent shortly."
              );
              // navigate back to vendor dashboard after brief pause
              setTimeout(() => navigate("/vendor/dashboard"), 1500);
            }
            // No more polling
            if (timeoutHandle) clearTimeout(timeoutHandle);
          } else if (s === "failed") {
            if (!shownRef.current) {
              shownRef.current = true;
              setStatus("failed");
              setMessage(
                "Payment failed. Please try again or contact support."
              );
              setTimeout(() => navigate("/vendor/dashboard"), 1500);
            }
            if (timeoutHandle) clearTimeout(timeoutHandle);
          } else if (s === "pending" || s === "processing" || s === "open") {
            // Still pending, check again after a longer interval to reduce noise
            // If backend sent final hint, stop polling immediately
            if (isFinal) {
              if (timeoutHandle) clearTimeout(timeoutHandle);
              setStatus(s === "failed" ? "failed" : "error");
              setMessage("Payment session closed.");
              return;
            }
            timeoutHandle = setTimeout(checkStatus, 6000);
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
      // cleanup pending timeout
      return () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      };
    } else {
      setStatus("error");
      setMessage("No payment reference found.");
    }
  }, [searchParams]);

  return (
    <div
      className="card"
      style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}
    >
      <h2>Payment Status</h2>

      <div
        className={`alert ${
          status === "success"
            ? "alert-success"
            : status === "failed"
            ? "alert-error"
            : "alert-info"
        }`}
      >
        {message}
      </div>

      {status !== "processing" && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => navigate("/vendor/dashboard")}
            className="btn btn-primary"
          >
            Return Home
          </button>
        </div>
      )}
    </div>
  );
}

export default PaymentCallback;
