import React, { useEffect, useState } from "react";
import AdminWebhooks from "./AdminWebhooks";

export default function AdminPanel() {
  const [ready, setReady] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [tab, setTab] = useState("native");

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem("vendorData") ||
        sessionStorage.getItem("vendorData");
      const v = raw ? JSON.parse(raw) : null;
      setIsStaff(!!(v && v.is_staff));
    } catch (e) {
      setIsStaff(false);
    }
    setReady(true);
  }, []);

  if (!ready) return <div>Checking permissions...</div>;

  if (!isStaff) {
    return (
      <div className="admin-locked">
        <h2>Admin Panel</h2>
        <p>
          Access restricted to Django staff users. Please sign in via Django
          Admin.
        </p>
        <p>
          Open the Django admin in a new tab:{" "}
          <a href="/admin/" target="_blank" rel="noreferrer">
            /admin/
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2>Admin Panel</h2>
        <div>
          <a className="btn" href="/admin/" target="_blank" rel="noreferrer">
            Open full Django Admin
          </a>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => setTab("native")}
            className={tab === "native" ? "active" : ""}
          >
            Webhook Audits (Native)
          </button>
          <button
            onClick={() => setTab("iframe")}
            className={tab === "iframe" ? "active" : ""}
          >
            Django Admin (iframe)
          </button>
        </div>

        {tab === "iframe" ? (
          <div
            style={{
              border: "1px solid var(--blue, #2b7cff)",
              marginTop: 8,
              height: "75vh",
            }}
          >
            <iframe
              title="Django Admin"
              src="/admin/"
              style={{ width: "100%", height: "100%", border: "none" }}
              sandbox="allow-same-origin allow-forms allow-scripts allow-popups allow-modals"
            />
          </div>
        ) : (
          <div>
            <AdminWebhooks />
          </div>
        )}
      </div>
    </div>
  );
}
