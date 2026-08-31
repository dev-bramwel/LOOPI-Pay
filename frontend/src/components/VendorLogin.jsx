import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

function VendorLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/vendors/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.tokens) {
          // Persist tokens to localStorage if Remember Me is checked; otherwise use sessionStorage
          if (remember) {
            localStorage.setItem("vendorToken", data.tokens.access);
            localStorage.setItem("vendorRefreshToken", data.tokens.refresh);
            localStorage.setItem(
              "vendorData",
              JSON.stringify(data.vendor || { email: form.email })
            );
          } else {
            sessionStorage.setItem("vendorToken", data.tokens.access);
            sessionStorage.setItem("vendorRefreshToken", data.tokens.refresh);
            sessionStorage.setItem(
              "vendorData",
              JSON.stringify(data.vendor || { email: form.email })
            );
          }
          navigate("/vendor/dashboard");
        } else {
          setError("Login succeeded but no tokens returned");
        }
      } else {
        setError(data.error || JSON.stringify(data));
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
      <h1>Vendor Login</h1>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="form-group">
          <label>Email</label>
          <input
            name="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me
            </label>
            <Link to="/vendor/forgot-password" className="tab">
              Forgot password?
            </Link>
            <Link to="/vendor/register">
              <button type="button" className="btn btn-secondary">
                Register
              </button>
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}

export default VendorLogin;
