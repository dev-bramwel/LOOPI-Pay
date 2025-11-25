import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function VendorLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
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
          localStorage.setItem("vendorToken", data.tokens.access);
          localStorage.setItem("vendorRefreshToken", data.tokens.refresh);
          localStorage.setItem(
            "vendorData",
            JSON.stringify(data.vendor || { email: form.email })
          );
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
    <div className="auth-container">
      <h1>Vendor Login</h1>
      <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
        <div style={{ marginBottom: 8 }}>
          <label>Email</label>
          <input
            name="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Password</label>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>
        {error && <div style={{ color: "red", marginBottom: 8 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
          <Link to="/vendor/register">
            <button type="button">Register</button>
          </Link>
        </div>
      </form>
    </div>
  );
}

export default VendorLogin;
