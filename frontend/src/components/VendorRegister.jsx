import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function VendorRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    password2: "",
    business_name: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.password2)
      return setError("Passwords do not match");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/vendors/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        // If tokens returned, store and navigate to dashboard
        if (data.tokens) {
          localStorage.setItem("vendorToken", data.tokens.access);
          localStorage.setItem("vendorRefreshToken", data.tokens.refresh);
          localStorage.setItem(
            "vendorData",
            JSON.stringify(
              data.vendor || {
                email: form.email,
                business_name: form.business_name,
              }
            )
          );
          navigate("/vendor/dashboard");
        } else {
          // If verification required, inform user
          navigate("/vendor/login");
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
      <h1>Vendor Registration</h1>
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
          <label>Username</label>
          <input
            name="username"
            value={form.username}
            onChange={handleChange}
            required
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Business Name</label>
          <input
            name="business_name"
            value={form.business_name}
            onChange={handleChange}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Phone</label>
          <input name="phone" value={form.phone} onChange={handleChange} />
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
        <div style={{ marginBottom: 12 }}>
          <label>Confirm Password</label>
          <input
            name="password2"
            type="password"
            value={form.password2}
            onChange={handleChange}
            required
          />
        </div>
        {error && <div style={{ color: "red", marginBottom: 8 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </button>
          <Link to="/vendor/login">
            <button type="button">Login</button>
          </Link>
        </div>
      </form>
    </div>
  );
}

export default VendorRegister;
