import React, { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

function getToken() {
  return (
    localStorage.getItem("vendorToken") || sessionStorage.getItem("vendorToken")
  );
}

export default function AdminWebhooks() {
  const [loading, setLoading] = useState(false);
  const [audits, setAudits] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  async function loadPage(p = 1) {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(
        `${API_URL}/api/payments/admin/webhook-audits/?page=${p}&page_size=${pageSize}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAudits(data.results || []);
      setTotal(data.count || 0);
      setPage(data.page || p);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage(1);
  }, []);

  async function openDetail(audit) {
    setSelected({ loading: true });
    const token = getToken();
    try {
      const res = await fetch(
        `${API_URL}/api/payments/admin/webhook-audits/${audit.id}/`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSelected({ loading: false, data });
    } catch (e) {
      setSelected({ loading: false, error: e.message || String(e) });
    }
  }

  async function reprocessCurrent() {
    if (!selected || !selected.data) return;
    const id = selected.data.id;
    const token = getToken();
    setSelected((s) => ({ ...s, reprocessing: true }));
    try {
      const res = await fetch(
        `${API_URL}/api/payments/admin/webhook-audits/${id}/reprocess/`,
        {
          method: "POST",
          headers: Object.assign(
            { "Content-Type": "application/json" },
            token ? { Authorization: `Bearer ${token}` } : {}
          ),
        }
      );
      const j = await res.json();
      // refresh detail and list
      await openDetail({ id });
      await loadPage(page);
      setSelected((s) => ({ ...s, reprocessing: false, reprocessResult: j }));
    } catch (e) {
      setSelected((s) => ({
        ...s,
        reprocessing: false,
        reprocessError: e.message || String(e),
      }));
    }
  }

  return (
    <div className="admin-webhooks">
      <h3>Webhook Audits</h3>
      {error ? <div className="error">{error}</div> : null}
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 8 }}>
            <button onClick={() => loadPage(page)} disabled={loading}>
              Refresh
            </button>
          </div>
          <div
            style={{
              maxHeight: "60vh",
              overflow: "auto",
              border: "1px solid #ddd",
            }}
          >
            <table
              className="table admin-table"
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Event</th>
                  <th>Reference</th>
                  <th>Received</th>
                  <th>Processed</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => openDetail(a)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{a.id}</td>
                    <td>{a.event}</td>
                    <td>{a.reference}</td>
                    <td>{new Date(a.received_at).toLocaleString()}</td>
                    <td>{a.processed ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {audits.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>
                      {loading ? "Loading..." : "No audits"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => loadPage(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              Prev
            </button>
            <span style={{ margin: "0 8px" }}>
              Page {page} / {Math.ceil(total / pageSize) || 1}
            </span>
            <button
              onClick={() => loadPage(page + 1)}
              disabled={page * pageSize >= total}
            >
              Next
            </button>
          </div>
        </div>

        <div style={{ width: 520 }}>
          <div style={{ border: "1px solid #eee", padding: 8, minHeight: 200 }}>
            {!selected && <div>Select an audit to inspect</div>}
            {selected && selected.loading && <div>Loading...</div>}
            {selected && selected.error && (
              <div className="error">{selected.error}</div>
            )}
            {selected && selected.data && (
              <div>
                <h4>Audit #{selected.data.id}</h4>
                <div>
                  <strong>Event:</strong> {selected.data.event}
                </div>
                <div>
                  <strong>Reference:</strong> {selected.data.reference}
                </div>
                <div>
                  <strong>Processed:</strong>{" "}
                  {selected.data.processed ? "Yes" : "No"}
                </div>
                <div style={{ marginTop: 8 }}>
                  <strong>Result:</strong>
                  <pre
                    style={{
                      maxHeight: 120,
                      overflow: "auto",
                      background: "#f7f7f7",
                      padding: 8,
                    }}
                  >
                    {selected.data.result}
                  </pre>
                </div>
                <div style={{ marginTop: 8 }}>
                  <strong>Payload:</strong>
                  <pre
                    style={{
                      maxHeight: 180,
                      overflow: "auto",
                      background: "#fff",
                      padding: 8,
                    }}
                  >
                    {JSON.stringify(selected.data.payload, null, 2)}
                  </pre>
                </div>
                <div style={{ marginTop: 8 }}>
                  <strong>Headers:</strong>
                  <pre
                    style={{
                      maxHeight: 120,
                      overflow: "auto",
                      background: "#fff",
                      padding: 8,
                    }}
                  >
                    {JSON.stringify(selected.data.headers || {}, null, 2)}
                  </pre>
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button
                    onClick={reprocessCurrent}
                    disabled={selected.reprocessing}
                  >
                    {selected.reprocessing ? "Reprocessing..." : "Reprocess"}
                  </button>
                  <button onClick={() => setSelected(null)}>Close</button>
                </div>
                {selected.reprocessResult && (
                  <div style={{ marginTop: 8 }}>
                    Result: {JSON.stringify(selected.reprocessResult)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
