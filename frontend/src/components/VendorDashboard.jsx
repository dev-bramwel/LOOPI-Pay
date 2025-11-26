import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function VendorDashboard({ handleLogout }) {
  const [vendor, setVendor] = useState(null);
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [generatedQR, setGeneratedQR] = useState(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("vendorToken");
    if (!token) {
      navigate("/vendor/login");
      return;
    }

    const vendorData = JSON.parse(localStorage.getItem("vendorData") || "{}");
    setVendor(vendorData);

    fetchDashboardStats();
    fetchTransactions();
  }, [navigate]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("vendorToken");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/vendors/dashboard/stats/`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else if (response.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/vendors/transactions/`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      } else if (response.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  };

  const generateQR = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/vendors/transactions/initiate/`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ amount: parseFloat(amount) }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setGeneratedQR(data);
        setAmount("");
        fetchDashboardStats();
        fetchTransactions();
      } else {
        setError(data.error || "Failed to generate QR code");
      }
    } catch (err) {
      setError("Network error. Please check your connection.", err);
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    if (!generatedQR) return;
    const link = document.createElement("a");
    link.href = generatedQR.qr_code;
    link.download = `qr_${generatedQR.session_id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openAsCustomer = () => {
    if (!generatedQR) return;
    const frontendBase =
      import.meta.env.VITE_FRONTEND_URL || window.location.origin;
    const url = `${frontendBase.replace(
      /\/$/,
      ""
    )}/pay?session_id=${encodeURIComponent(generatedQR.session_id)}`;
    window.open(url, "_blank");
  };

  // Countdown and pending animation for generated QR
  const [countdown, setCountdown] = useState(null);
  const [spinnerIndex, setSpinnerIndex] = useState(0);
  const spinnerChars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info",
  });
  const [cancelSent, setCancelSent] = useState(false);

  useEffect(() => {
    let intervalId;
    let spinnerId;
    if (generatedQR) {
      // prefer transaction.created_at then created_at field
      const createdAt =
        generatedQR.transaction?.created_at ||
        generatedQR.created_at ||
        new Date().toISOString();
      const start = new Date(createdAt).getTime();
      const update = () => {
        const now = Date.now();
        const elapsed = Math.floor((now - start) / 1000);
        const remaining = Math.max(0, 60 - elapsed);
        setCountdown(remaining);
        if (remaining <= 0) {
          // local fallback; server will mark failed on next poll
          setGeneratedQR((prev) => ({ ...prev, status: "failed" }));
          // notify backend once that the payment was cancelled/auto-failed
          try {
            if (!cancelSent && generatedQR && generatedQR.session_id) {
              // fire-and-forget cancel request (authenticated)
              fetch(`${API_URL}/api/payments/cancel/`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ session_id: generatedQR.session_id }),
              })
                .then((r) => {
                  if (!r.ok) {
                    console.warn("Cancel request failed", r.status);
                  } else {
                    setToast({
                      visible: true,
                      message: "Session cancelled",
                      type: "info",
                    });
                    setTimeout(
                      () => setToast((t) => ({ ...t, visible: false })),
                      4000
                    );
                  }
                })
                .catch((e) => console.warn("Cancel request error", e));
              setCancelSent(true);
            }
          } catch (e) {
            console.warn("Error sending cancel request", e);
          }
        }
      };
      update();
      intervalId = setInterval(update, 1000);

      spinnerId = setInterval(() => {
        setSpinnerIndex((i) => (i + 1) % spinnerChars.length);
      }, 120);
    } else {
      setCountdown(null);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (spinnerId) clearInterval(spinnerId);
    };
  }, [generatedQR]);

  // Camera scanning using BarcodeDetector (if available)
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const barcodeDetectorRef = useRef(null);
  const scanningRef = useRef(false);

  const stopScan = async () => {
    setScanning(false);
    setScanError(null);
    try {
      const stream = videoRef.current && videoRef.current.srcObject;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch (e) {
      console.warn("Error stopping camera", e);
    }
  };

  const startScan = async () => {
    setScanError(null);
    if (!generatedQR) return setScanError("No QR generated to scan");

    // Try BarcodeDetector first, otherwise fallback to jsQR.
    const hasBarcode = window.BarcodeDetector !== undefined;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      scanningRef.current = true;
      setScanning(true);

      if (hasBarcode) {
        barcodeDetectorRef.current = new window.BarcodeDetector({
          formats: ["qr_code"],
        });

        const scanLoop = async () => {
          if (!scanningRef.current) return;
          try {
            const detections = await barcodeDetectorRef.current.detect(
              videoRef.current
            );
            if (detections && detections.length > 0) {
              const raw = detections[0].rawValue;
              if (raw && raw.startsWith("http")) window.open(raw, "_blank");
              else openAsCustomer();
              await stopScan();
              return;
            }
          } catch (err) {
            console.warn("Barcode detection error", err);
          }
          setTimeout(scanLoop, 300);
        };

        scanLoop();
      } else {
        // Fallback: use jsQR to decode frames from a canvas
        let jsQRModule = null;
        try {
          jsQRModule = (await import("jsqr")).default || (await import("jsqr"));
        } catch (e) {
          setScanError(
            "No BarcodeDetector and failed to load jsQR. Use your phone camera to scan the QR.",
            e
          );
          setScanning(false);
          scanningRef.current = false;
          return;
        }

        const canvas = canvasRef.current || document.createElement("canvas");
        canvasRef.current = canvas;
        const ctx = canvas.getContext("2d");

        const scanLoopJsqr = async () => {
          if (!scanningRef.current) return;
          try {
            const video = videoRef.current;
            if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
              setTimeout(scanLoopJsqr, 300);
              return;
            }
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            );
            const code = jsQRModule(
              imageData.data,
              canvas.width,
              canvas.height
            );
            if (code && code.data) {
              const raw = code.data;
              if (raw && raw.startsWith("http")) window.open(raw, "_blank");
              else openAsCustomer();
              await stopScan();
              return;
            }
          } catch (err) {
            console.warn("jsQR scan error", err);
          }
          setTimeout(scanLoopJsqr, 300);
        };

        scanLoopJsqr();
      }
    } catch (err) {
      console.error("startScan error", err);
      setScanError("Unable to access camera or start scanner");
      setScanning(false);
      scanningRef.current = false;
    }
  };

  // cleanup on unmount
  useEffect(() => {
    return () => {
      scanningRef.current = false;
      stopScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusBadge = (status) => {
    const badges = {
      pending: "badge-warning",
      paid: "badge-success",
      completed: "badge-success",
      failed: "badge-error",
    };
    return badges[status] || "badge-info";
  };

  // Poll payment status for the active generated QR session
  useEffect(() => {
    if (!generatedQR) return;

    let stopped = false;
    let intervalId = null;

    const pollStatus = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/payments/status/${generatedQR.session_id}/`,
          { headers: getAuthHeaders() }
        );

        if (!response.ok) {
          // if unauthorized, trigger logout
          if (response.status === 401) {
            handleLogout();
          }
          return;
        }

        const data = await response.json();

        // update generatedQR status if it changed
        if (data.status && data.status !== generatedQR.status) {
          setGeneratedQR((prev) => ({ ...prev, status: data.status }));
          // show a toast when payment completes or fails
          if (data.status === "completed") {
            setToast({
              visible: true,
              message: "Payment completed ✅",
              type: "success",
            });
            setTimeout(() => setToast((t) => ({ ...t, visible: false })), 5000);
          } else if (data.status === "failed") {
            setToast({
              visible: true,
              message: "Payment failed ❌",
              type: "error",
            });
            setTimeout(() => setToast((t) => ({ ...t, visible: false })), 5000);
          }
        }

        // stop polling when final state reached
        if (data.status === "completed" || data.status === "failed") {
          stopped = true;
          // refresh transactions and stats so UI reflects change
          fetchDashboardStats();
          fetchTransactions();
          if (intervalId) clearInterval(intervalId);
        }
      } catch (err) {
        console.error("Error polling payment status:", err);
        // don't spam on network errors; let it try again on next interval
      }
    };

    // immediate poll then interval
    pollStatus();
    intervalId = setInterval(() => {
      if (!stopped) pollStatus();
    }, 6000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [generatedQR]);

  if (!vendor) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {toast.visible && (
        <div
          className={`toast toast-${toast.type}`}
          style={{
            position: "fixed",
            right: 20,
            top: 20,
            zIndex: 2000,
            padding: "10px 16px",
            borderRadius: 6,
            background:
              toast.type === "success"
                ? "#D1FAE5"
                : toast.type === "error"
                ? "#FEE2E2"
                : "#E6F0FF",
            color: "#0F172A",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          }}
        >
          {toast.message}
        </div>
      )}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Vendor Dashboard</h1>
          <p>Welcome, {vendor.business_name || vendor.email}</p>
        </div>
        <button className="btn btn-secondary" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="dashboard-tabs">
        <button
          className={`tab ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={`tab ${activeTab === "generate" ? "active" : ""}`}
          onClick={() => setActiveTab("generate")}
        >
          Generate QR
        </button>
        <button
          className={`tab ${activeTab === "transactions" ? "active" : ""}`}
          onClick={() => setActiveTab("transactions")}
        >
          Transactions
        </button>
      </div>

      {activeTab === "dashboard" && stats && (
        <div className="dashboard-content">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Transactions</h3>
              <p className="stat-value">{stats.total_transactions}</p>
            </div>
            <div className="stat-card">
              <h3>Total Revenue</h3>
              <p className="stat-value">
                ₦{stats.total_revenue.toLocaleString()}
              </p>
            </div>
            <div className="stat-card">
              <h3>Today's Revenue</h3>
              <p className="stat-value">
                ₦{stats.today_revenue.toLocaleString()}
              </p>
            </div>
            <div className="stat-card">
              <h3>Pending</h3>
              <p className="stat-value">{stats.pending_count}</p>
            </div>
            <div className="stat-card">
              <h3>Paid</h3>
              <p className="stat-value">{stats.paid_count}</p>
            </div>
            <div className="stat-card">
              <h3>Failed</h3>
              <p className="stat-value">{stats.failed_count}</p>
            </div>
          </div>

          {stats.recent_transactions &&
            stats.recent_transactions.length > 0 && (
              <div className="recent-transactions">
                <h2>Recent Transactions</h2>
                <div className="transactions-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Session ID</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recent_transactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td>{transaction.session_id}</td>
                          <td>
                            ₦{parseFloat(transaction.amount).toLocaleString()}
                          </td>
                          <td>
                            <span
                              className={`badge ${getStatusBadge(
                                transaction.status
                              )}`}
                            >
                              {transaction.status}
                            </span>
                          </td>
                          <td>
                            {new Date(
                              transaction.created_at
                            ).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </div>
      )}

      {activeTab === "generate" && (
        <div className="dashboard-content">
          {error && <div className="alert alert-error">{error}</div>}

          {!generatedQR ? (
            <div className="generate-section">
              <h2>Generate Payment QR Code</h2>
              <p>Enter the amount to create a QR code for customer payment</p>

              <form onSubmit={generateQR} className="generate-form">
                <div className="form-group">
                  <label>Amount (₦)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    min="1"
                    step="0.01"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? "Generating..." : "Generate QR Code"}
                </button>
              </form>
            </div>
          ) : (
            <div className="generated-qr">
              <div className="alert alert-success">
                ✅ QR Code Generated Successfully!
              </div>
              <div className="qr-display">
                <img src={generatedQR.qr_code} alt="Payment QR Code" />
              </div>
              <div className="qr-details">
                <div className="detail-row">
                  <span>Session ID:</span>
                  <strong>{generatedQR.session_id}</strong>
                </div>
                <div className="detail-row">
                  <span>Amount:</span>
                  <strong>
                    ₦{parseFloat(generatedQR.amount).toLocaleString()}
                  </strong>
                </div>
                <div className="detail-row">
                  <span>Status:</span>
                  {generatedQR.status === "failed" ? (
                    <span className="badge badge-error">Failed</span>
                  ) : (
                    <span className="badge badge-warning">Pending Payment</span>
                  )}
                </div>
                {countdown !== null && (
                  <div className="detail-row">
                    <span>Auto-fail in:</span>
                    <strong>
                      {countdown}s{" "}
                      {generatedQR.status === "pending" && (
                        <span>{spinnerChars[spinnerIndex]}</span>
                      )}
                    </strong>
                  </div>
                )}
              </div>
              <div className="button-group">
                <button className="btn btn-primary" onClick={downloadQR}>
                  Download QR Code
                </button>
                <button className="btn btn-primary" onClick={openAsCustomer}>
                  Open as Customer
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setGeneratedQR(null)}
                >
                  Generate Another
                </button>
                <button
                  className={`btn ${scanning ? "btn-error" : "btn-outline"}`}
                  onClick={() => (scanning ? stopScan() : startScan())}
                >
                  {scanning ? "Stop Scan" : "Scan with Camera"}
                </button>
              </div>
              {scanError && (
                <div className="alert alert-error">{scanError}</div>
              )}
              {scanning && (
                <div
                  className="scan-modal"
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    background: "rgba(0,0,0,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000,
                  }}
                >
                  <div
                    style={{
                      background: "#fff",
                      padding: 16,
                      borderRadius: 8,
                      maxWidth: 520,
                      width: "95%",
                      textAlign: "center",
                    }}
                  >
                    <video
                      ref={videoRef}
                      style={{ width: "100%", maxWidth: 480, borderRadius: 6 }}
                      muted
                      playsInline
                    />
                    <div style={{ marginTop: 8 }} className="scan-hint">
                      Point camera at the QR code
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <button className="btn btn-secondary" onClick={stopScan}>
                        Stop
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="dashboard-content">
          <h2>All Transactions</h2>
          {transactions.length === 0 ? (
            <div className="empty-state">
              <p>No transactions yet. Generate a QR code to get started!</p>
            </div>
          ) : (
            <div className="transactions-table">
              <table>
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Paid At</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="session-id">{transaction.session_id}</td>
                      <td>
                        ₦{parseFloat(transaction.amount).toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={`badge ${getStatusBadge(
                            transaction.status
                          )}`}
                        >
                          {transaction.status}
                        </span>
                      </td>
                      <td>
                        {new Date(transaction.created_at).toLocaleString()}
                      </td>
                      <td>
                        {transaction.paid_at
                          ? new Date(transaction.paid_at).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default VendorDashboard;
