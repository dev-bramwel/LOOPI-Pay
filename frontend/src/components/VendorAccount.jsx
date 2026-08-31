import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

function VendorAccount() {
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [form, setForm] = useState({
    email: "",
    username: "",
    business_name: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info",
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem("vendorToken");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  useEffect(() => {
    const token = localStorage.getItem("vendorToken");
    if (!token) return navigate("/vendor/login");

    const local = JSON.parse(localStorage.getItem("vendorData") || "null");
    if (local) {
      setVendor(local);
      setForm({
        email: local.email || "",
        username: local.username || "",
        business_name: local.business_name || "",
        phone: local.phone || "",
      });
    }

    // fetch latest profile from API
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/vendors/profile/`, {
          headers: getAuthHeaders(),
        });
        if (res.status === 401) return navigate("/vendor/login");
        if (!res.ok) return;
        const data = await res.json();
        setVendor(data);
        setForm({
          email: data.email || "",
          username: data.username || "",
          business_name: data.business_name || "",
          phone: data.phone || "",
        });
        localStorage.setItem("vendorData", JSON.stringify(data));
      } catch (e) {
        console.warn("Failed to load profile", e);
      }
    })();
  }, [navigate]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/vendors/profile/update/`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) return navigate("/vendor/login");
      if (!res.ok) {
        setError(data.error || JSON.stringify(data));
      } else {
        setToast({
          visible: true,
          message: "Profile updated",
          type: "success",
        });
        setTimeout(() => setToast((t) => ({ ...t, visible: false })), 4000);
        setVendor(data);
        localStorage.setItem("vendorData", JSON.stringify(data));
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!vendor) {
    return (
      <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>Account</h1>
        <div>
          <button
            className="btn btn-secondary"
            onClick={() => navigate("/vendor/dashboard")}
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="toast-container" aria-live="polite">
        <div
          className={`toast ${toast.visible ? "show" : ""} ${
            toast.type === "success" ? "toast-success" : ""
          }`}
        >
          {toast.message}
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Verification status */}
      <div
        style={{
          margin: "12px 0",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <strong>Email status:</strong>
        </div>
        <div>
          {vendor.is_verified ? (
            <span className="badge badge-success">Verified</span>
          ) : (
            <>
              <span className="badge badge-warning">Not Verified</span>
              <div style={{ display: "inline-block", marginLeft: 10 }}>
                <button
                  className="btn btn-outline"
                  onClick={async () => {
                    try {
                      const res = await fetch(
                        `${API_URL}/api/vendors/resend-verification/`,
                        {
                          method: "POST",
                          headers: getAuthHeaders(),
                          body: JSON.stringify({ email: vendor.email }),
                        }
                      );
                      if (res.status === 404) {
                        setToast({
                          visible: true,
                          message:
                            "Resend verification not available on server.",
                          type: "error",
                        });
                        setTimeout(
                          () => setToast((t) => ({ ...t, visible: false })),
                          4000
                        );
                        return;
                      }
                      if (!res.ok) {
                        const body = await res.json().catch(() => ({}));
                        setToast({
                          visible: true,
                          message:
                            body.error || "Failed to resend verification.",
                          type: "error",
                        });
                        setTimeout(
                          () => setToast((t) => ({ ...t, visible: false })),
                          4000
                        );
                        return;
                      }
                      setToast({
                        visible: true,
                        message: "Verification email resent.",
                        type: "success",
                      });
                      setTimeout(
                        () => setToast((t) => ({ ...t, visible: false })),
                        4000
                      );
                    } catch (e) {
                      setToast({
                        visible: true,
                        message: "Network error while resending.",
                        type: "error",
                      });
                      setTimeout(
                        () => setToast((t) => ({ ...t, visible: false })),
                        4000
                      );
                    }
                  }}
                >
                  Resend Verification
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 700, margin: "0 auto" }}>
        <div className="form-group">
          <label>Email (read-only)</label>
          <input name="email" value={form.email} readOnly />
        </div>

        <div className="form-group">
          <label>Username</label>
          <input
            name="username"
            value={form.username}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label>Business Name</label>
          <input
            name="business_name"
            value={form.business_name}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label>Phone</label>
          <input name="phone" value={form.phone} onChange={handleChange} />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default VendorAccount;
