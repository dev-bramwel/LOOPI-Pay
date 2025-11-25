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
