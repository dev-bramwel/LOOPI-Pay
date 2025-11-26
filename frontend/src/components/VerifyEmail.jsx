import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function VerifyEmail({ setIsVendor }) {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("Verifying your email...");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setError("Invalid verification link");
      return;
    }

    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token) => {
    try {
      const response = await fetch(
        `${API_URL}/api/vendors/verify/?token=${token}`
      );
      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(data.message);

        // Store tokens and auto-login
        if (data.tokens) {
          localStorage.setItem("vendorToken", data.tokens.access);
          localStorage.setItem("vendorRefreshToken", data.tokens.refresh);
          localStorage.setItem("vendorData", JSON.stringify(data.vendor));
          setIsVendor(true);

          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            navigate("/vendor/dashboard");
          }, 2000);
        }
      } else {
        setStatus("error");
        setError(data.error || "Verification failed");
      }
    } catch (err) {
      setStatus("error");
      setError("Network error. Please try again.");
    }
  };

  return (
    <div
      className="card"
      style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}
    >
      <h1>Email Verification</h1>

      {status === "verifying" && <p>{message}</p>}

      {status === "success" && (
        <div>
          <h2>✅ Email Verified!</h2>
          <p>{message}</p>
          <p>Redirecting to your dashboard...</p>
        </div>
      )}

      {status === "error" && (
        <div>
          <h2>❌ Verification Failed</h2>
          <div className="alert alert-error" style={{ margin: 12 }}>
            {error}
          </div>
          <p>
            <Link to="/vendor/register" className="tab">
              Register Again
            </Link>{" "}
            |{" "}
            <Link to="/vendor/login" className="tab">
              Go to Login
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

export default VerifyEmail;
