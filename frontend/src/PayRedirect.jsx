import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function PayRedirect() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Preparing checkout...");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      setStatus("error");
      setMessage("Missing session_id in URL");
      return;
    }

    const initiate = async () => {
      try {
        const resp = await fetch(
          `${API_URL}/api/payments/public-initiate/?session_id=${encodeURIComponent(
            sessionId
          )}`
        );

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          setStatus("error");
          setMessage(err.error || "Failed to initiate payment");
          return;
        }

        const data = await resp.json();
        if (data.checkout_url) {
          // Persist mapping reference -> session_id so the callback can resolve
          // the session without needing to parse the reference string.
          try {
            if (data.reference && data.session_id) {
              localStorage.setItem(
                `pay_ref:${data.reference}`,
                data.session_id
              );
            }
          } catch (e) {
            // ignore storage errors (private mode, etc.)
          }

          // Redirect browser to Paystack checkout
          window.location.href = data.checkout_url;
        } else {
          setStatus("error");
          setMessage("No checkout URL returned");
        }
      } catch (err) {
        setStatus("error");
        setMessage("Network error initiating payment");
      }
    };

    initiate();
  }, [searchParams]);

  return (
    <div className="container">
      <h2>Redirecting to Payment</h2>
      <div className={`alert alert-${status === "error" ? "error" : "info"}`}>
        {message}
      </div>
    </div>
  );
}

export default PayRedirect;
