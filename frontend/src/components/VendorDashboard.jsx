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

  // Countdown (time remaining) since QR/session initiation and pending animation for generated QR
  // 3 minutes = 180 seconds
  const [countdown, setCountdown] = useState(null);
  const [spinnerIndex, setSpinnerIndex] = useState(0);
  const spinnerChars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info",
  });
  // no auto-cancel: we track elapsed and let backend decide
  const [canceling, setCanceling] = useState(false);
  const [autoCancelSent, setAutoCancelSent] = useState(false);
  const clearTimersRef = useRef([]);

  // schedule clearing of the generated QR from UI (for security)
  const scheduleClearGeneratedQR = (delay = 3000) => {
    const id = setTimeout(() => setGeneratedQR(null), delay);
    clearTimersRef.current.push(id);
  };

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
        const elapsedSec = Math.floor((now - start) / 1000);
        const remaining = Math.max(0, 180 - elapsedSec);
        setCountdown(remaining);

        // If the session is final, stop further updates
        if (
          generatedQR.status === "completed" ||
          generatedQR.status === "failed"
        ) {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          if (spinnerId) {
            clearInterval(spinnerId);
            spinnerId = null;
          }
        }

        // If countdown expired and we haven't sent auto-cancel yet, mark failed and notify backend
        if (remaining <= 0 && !autoCancelSent) {
          setAutoCancelSent(true);
          setGeneratedQR((prev) => ({ ...prev, status: "failed" }));
          try {
            fetch(`${API_URL}/api/payments/cancel/`, {
              method: "POST",
              headers: getAuthHeaders(),
              body: JSON.stringify({ session_id: generatedQR.session_id }),
            })
              .then((r) => {
                if (!r.ok) {
                  console.warn("Auto-cancel request failed", r.status);
                } else {
                  setToast({
                    visible: true,
                    message: "Session auto-cancelled",
                    type: "info",
                  });
                  setTimeout(
                    () => setToast((t) => ({ ...t, visible: false })),
                    4000
                  );
                  fetchDashboardStats();
                  fetchTransactions();
                  // clear the QR from the UI after a short delay for security
                  scheduleClearGeneratedQR(2500);
                }
              })
              .catch((e) => console.warn("Auto-cancel error", e));
          } catch (e) {
            console.warn("Error sending auto-cancel", e);
          }
        }
      };

      // If already final, set countdown once and don't start intervals
      if (
        generatedQR.status === "completed" ||
        generatedQR.status === "failed"
      ) {
        const now = Date.now();
        const elapsedSec = Math.floor((now - start) / 1000);
        const remaining = Math.max(0, 180 - elapsedSec);
        setCountdown(remaining);
        setSpinnerIndex(0);
      } else {
        update();
        intervalId = setInterval(update, 1000);

        spinnerId = setInterval(() => {
          setSpinnerIndex((i) => (i + 1) % spinnerChars.length);
        }, 120);
      }
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
      // Ensure the scanning modal/video element is rendered before attaching the stream.
      scanningRef.current = true;
      setScanning(true);

      // Wait shortly for the video element to mount, up to a few ticks.
      const waitForVideo = async () => {
        for (let i = 0; i < 10; i++) {
          if (videoRef.current) return;
          // small delay
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 50));
        }
      };

      await waitForVideo();

      if (videoRef.current) {
        try {
          videoRef.current.srcObject = stream;
          // some browsers require play() to be called after being visible
          // ignore play errors (autoplay policies) and continue — scanner will use frames when available
          // eslint-disable-next-line no-await-in-loop
          await videoRef.current.play().catch(() => {});
        } catch (e) {
          console.warn("Video play error", e);
        }
      }

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

  // cleanup any scheduled timers when component unmounts
  useEffect(() => {
    return () => {
      (clearTimersRef.current || []).forEach((id) => clearTimeout(id));
      clearTimersRef.current = [];
    };
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

    // Do not start polling if session already final
    if (generatedQR.status === "completed" || generatedQR.status === "failed") {
      // ensure UI is fresh
      fetchDashboardStats();
      fetchTransactions();
      // clear the QR from the UI shortly after mount (security)
      scheduleClearGeneratedQR(800);
      return;
    }

    let stopped = false;
    let intervalId = null;
    const finalToastShownRef = { current: false };

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
        // respect backend hint header to stop polling immediately
        const isFinal = response.headers.get("x-payment-final");

        // normalize status value
        const s = (data.status || "").toString().toLowerCase();

        // update generatedQR status if it changed (always normalize to lowercase)
        if (s && s !== (generatedQR.status || "").toString().toLowerCase()) {
          setGeneratedQR((prev) => ({ ...prev, status: s }));
          // show a toast when payment completes or fails, but only once per session
          if (
            (s === "completed" || s === "failed") &&
            !finalToastShownRef.current
          ) {
            finalToastShownRef.current = true;
            setToast({
              visible: true,
              message:
                s === "completed"
                  ? "Payment completed ✅"
                  : "Payment failed ❌",
              type: s === "completed" ? "success" : "error",
            });
            setTimeout(() => setToast((t) => ({ ...t, visible: false })), 5000);
            // clear the QR from the UI after a short delay for security
            scheduleClearGeneratedQR(3000);
          }
        }

        // stop polling when final state reached (or backend hinted final)
        if (s === "completed" || s === "failed" || isFinal) {
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
      <div className="toast-container" aria-live="polite">
        <div
          className={`toast ${toast.visible ? "show" : ""} ${
            toast.type === "success"
              ? "toast-success"
              : toast.type === "error"
              ? "toast-error"
              : ""
          }`}
        >
          {toast.message}
        </div>
      </div>
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Vendor Dashboard</h1>
          <p>Welcome, {vendor.business_name || vendor.email}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/vendor/account")}
          >
            Account
          </button>
          <button className="btn btn-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
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
                KES {stats.total_revenue.toLocaleString()}
              </p>
            </div>
            <div className="stat-card">
              <h3>Today's Revenue</h3>
              <p className="stat-value">
                KES {stats.today_revenue.toLocaleString()}
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
                            KES{" "}
                            {parseFloat(transaction.amount).toLocaleString()}
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
                  <label>Amount (KES)</label>
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
              <div className="qr-display-wrap">
                <div className="qr-display">
                  <img src={generatedQR.qr_code} alt="Payment QR Code" />
                </div>
                <div
                  className={`success-check ${
                    generatedQR.status === "completed" ? "show" : ""
                  }`}
                  aria-hidden
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              </div>
              <div className="qr-details">
                <div className="detail-row">
                  <span>Session ID:</span>
                  <strong>{generatedQR.session_id}</strong>
                </div>
                <div className="detail-row">
                  <span>Amount:</span>
                  <strong>
                    KES {parseFloat(generatedQR.amount).toLocaleString()}
                  </strong>
                </div>
                <div className="detail-row">
                  <span>Status:</span>
                  {generatedQR.status === "failed" ? (
                    <span className="badge badge-error">Failed</span>
                  ) : generatedQR.status === "completed" ||
                    generatedQR.status === "paid" ? (
                    <span className="badge badge-success">Completed</span>
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
                {generatedQR.status === "pending" && (
                  <button
                    className="btn btn-warning"
                    onClick={async () => {
                      if (!generatedQR || !generatedQR.session_id) return;
                      const ok = window.confirm(
                        "Cancel this payment session? This will mark it failed."
                      );
                      if (!ok) return;
                      setCanceling(true);
                      try {
                        const r = await fetch(
                          `${API_URL}/api/payments/cancel/`,
                          {
                            method: "POST",
                            headers: getAuthHeaders(),
                            body: JSON.stringify({
                              session_id: generatedQR.session_id,
                            }),
                          }
                        );
                        if (!r.ok) {
                          const body = await r.json().catch(() => ({}));
                          setToast({
                            visible: true,
                            message: body.error || "Cancel failed",
                            type: "error",
                          });
                          setTimeout(
                            () => setToast((t) => ({ ...t, visible: false })),
                            4000
                          );
                        } else {
                          setGeneratedQR((prev) => ({
                            ...prev,
                            status: "failed",
                          }));
                          setToast({
                            visible: true,
                            message: "Session cancelled",
                            type: "info",
                          });
                          setTimeout(
                            () => setToast((t) => ({ ...t, visible: false })),
                            4000
                          );
                          fetchDashboardStats();
                          fetchTransactions();
                          // clear the QR from the UI after cancel for security
                          scheduleClearGeneratedQR(2500);
                        }
                      } catch (e) {
                        console.warn("Cancel error", e);
                        setToast({
                          visible: true,
                          message: "Network error cancelling",
                          type: "error",
                        });
                        setTimeout(
                          () => setToast((t) => ({ ...t, visible: false })),
                          4000
                        );
                      } finally {
                        setCanceling(false);
                      }
                    }}
                    disabled={canceling}
                  >
                    {canceling ? "Cancelling..." : "Cancel Session"}
                  </button>
                )}
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
                <div className="scan-modal-overlay">
                  <div className="scan-modal-card">
                    <video
                      ref={videoRef}
                      className="scan-video"
                      muted
                      playsInline
                    />
                    <div className="scan-hint">Point camera at the QR code</div>
                    <div className="scan-actions">
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
          {/* Line chart for completed amounts by day */}
          {transactions && transactions.length > 0 && (
            <div className="chart-container">
              <h3 className="chart-title">
                Completed Payments (by day). Watch your business grow!
              </h3>
              <LineChart transactions={transactions} />
            </div>
          )}
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
                        KES {parseFloat(transaction.amount).toLocaleString()}
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

// Simple inline LineChart component (SVG) — no external deps
function LineChart({ transactions }) {
  // timeframe options: hours, days, weeks, months, years
  const [timeframe, setTimeframe] = useState("days");
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    label: "",
  });
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(700);

  const scaleRef = useRef(1);
  const [scaleState, setScaleState] = useState(1);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);
  const pinchStartDistRef = useRef(0);
  const pinchStartScaleRef = useRef(1);

  const baseSpacingFor = (tf) =>
    tf === "hours"
      ? 80
      : tf === "days"
      ? 56
      : tf === "weeks"
      ? 72
      : tf === "months"
      ? 90
      : 120;

  useEffect(() => {
    const update = () => {
      const w = containerRef.current?.clientWidth || 700;
      setContainerWidth(w);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const completed = (transactions || []).filter((t) => {
    const s = (t.status || "").toString().toLowerCase();
    return s === "completed" || s === "paid";
  });

  // derive a key for grouping based on timeframe
  const keyFor = (date) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    switch (timeframe) {
      case "hours": {
        // round to 30 minute bins: produce key like YYYY-MM-DDTHH:MM where MM is 00 or 30
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const minute = d.getMinutes();
        const mbin = minute < 30 ? "00" : "30";
        return `${yyyy}-${mm}-${dd}T${hh}:${mbin}`;
      }
      case "weeks": {
        // compute ISO week-year start (Monday)
        const tmp = new Date(
          Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
        );
        const day = tmp.getUTCDay() || 7; // 1..7 (Mon..Sun)
        tmp.setUTCDate(tmp.getUTCDate() - day + 1);
        return tmp.toISOString().slice(0, 10);
      }
      case "months":
        return d.toISOString().slice(0, 7); // YYYY-MM
      case "years":
        return d.getFullYear().toString();
      case "days":
      default:
        return d.toISOString().slice(0, 10); // YYYY-MM-DD
    }
  };

  const labelFor = (key) => {
    if (!key) return "";
    switch (timeframe) {
      case "hours":
        // key: 'YYYY-MM-DDTHH:MM' -> show HH:MM
        return key.slice(-5);
      case "weeks":
        return key; // start of week date
      case "months":
        return key; // YYYY-MM
      case "years":
        return key;
      case "days":
      default:
        return key.slice(5); // MM-DD
    }
  };

  const groups = {};
  completed.forEach((t) => {
    const d =
      t.paid_at || t.created_at || t.createdAt || new Date().toISOString();
    const k = keyFor(d);
    if (!k) return;
    const amt = parseFloat(t.amount || 0) || 0;
    groups[k] = (groups[k] || 0) + amt;
  });

  const keys = Object.keys(groups).sort();
  // For hours timeframe, ensure we present fixed 30-minute bins for a single day (00:00 -> 23:30)
  if (timeframe === "hours") {
    // choose target day: use most recent completed transaction date or today
    let targetDay = null;
    if (completed.length > 0) {
      const latest = completed.reduce((a, b) => {
        const da = new Date(a.paid_at || a.created_at || a.createdAt || 0);
        const db = new Date(b.paid_at || b.created_at || b.createdAt || 0);
        return da > db ? a : b;
      });
      const d = new Date(
        latest.paid_at || latest.created_at || latest.createdAt || Date.now()
      );
      targetDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
    } else {
      const now = new Date();
      targetDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(now.getDate()).padStart(2, "0")}`;
    }

    const allBins = [];
    for (let i = 0; i < 48; i++) {
      const hh = String(Math.floor(i / 2)).padStart(2, "0");
      const mm = i % 2 === 0 ? "00" : "30";
      allBins.push(`${targetDay}T${hh}:${mm}`);
    }
    // ensure groups has zero for missing bins so chart displays them
    allBins.forEach((k) => {
      if (!Object.prototype.hasOwnProperty.call(groups, k)) groups[k] = 0;
    });
    // overwrite keys to be the full day's bins in order
    keys.length = 0;
    allBins.forEach((k) => keys.push(k));
  }
  if (keys.length === 0)
    return <div className="chart-empty">No completed payments yet</div>;

  // attach handlers for pan (drag), wheel-zoom, and pinch-zoom on the container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const clientX = e.clientX - rect.left + el.scrollLeft;
      const oldScale = scaleRef.current || 1;
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      let newScale = Math.max(0.4, Math.min(4, oldScale * zoomFactor));
      scaleRef.current = newScale;
      setScaleState(newScale);

      const base = baseSpacingFor(timeframe);
      const pad = 24;
      const oldWidth = Math.max(
        containerWidth,
        keys.length * base * oldScale + pad * 2
      );
      const newWidth = Math.max(
        containerWidth,
        keys.length * base * newScale + pad * 2
      );
      const ratio = clientX / oldWidth || 0;
      const newScroll = ratio * newWidth - (e.clientX - rect.left);
      el.scrollLeft = Math.max(0, newScroll);
    };

    const onMouseDown = (e) => {
      isDraggingRef.current = true;
      dragStartXRef.current = e.pageX - el.getBoundingClientRect().left;
      dragStartScrollRef.current = el.scrollLeft;
      el.classList.add("dragging");
    };

    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const x = e.pageX - el.getBoundingClientRect().left;
      const dx = x - dragStartXRef.current;
      el.scrollLeft = Math.max(0, dragStartScrollRef.current - dx);
    };

    const stopDrag = () => {
      isDraggingRef.current = false;
      el.classList.remove("dragging");
    };

    const getDist = (t1, t2) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const onTouchStart = (ev) => {
      if (ev.touches.length === 1) {
        dragStartXRef.current =
          ev.touches[0].clientX - el.getBoundingClientRect().left;
        dragStartScrollRef.current = el.scrollLeft;
      } else if (ev.touches.length === 2) {
        pinchStartDistRef.current = getDist(ev.touches[0], ev.touches[1]);
        pinchStartScaleRef.current = scaleRef.current || 1;
      }
    };

    const onTouchMove = (ev) => {
      if (ev.touches.length === 1 && !isDraggingRef.current) {
        const x = ev.touches[0].clientX - el.getBoundingClientRect().left;
        const dx = x - dragStartXRef.current;
        el.scrollLeft = Math.max(0, dragStartScrollRef.current - dx);
      } else if (ev.touches.length === 2) {
        ev.preventDefault();
        const d = getDist(ev.touches[0], ev.touches[1]);
        const factor = d / (pinchStartDistRef.current || d || 1);
        let newScale = Math.max(
          0.4,
          Math.min(4, (pinchStartScaleRef.current || 1) * factor)
        );
        scaleRef.current = newScale;
        setScaleState(newScale);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopDrag);
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopDrag);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [containerRef, keys.length, timeframe, containerWidth]);

  // spacing: number of pixels per point to allow horizontal zooming/scroll
  const pointSpacing = baseSpacingFor(timeframe) * (scaleRef.current || 1);

  // compute svg width based on points and container width
  const pad = 24;
  const w = Math.max(containerWidth, keys.length * pointSpacing + pad * 2);
  const h = 180;

  const values = keys.map((k) => groups[k]);
  const max = Math.max(...values);
  const min = Math.min(...values);

  const points = values.map((v, i) => {
    const x = pad + i * ((w - pad * 2) / Math.max(1, keys.length - 1));
    const y =
      h - pad - ((v - min) / Math.max(1, max - min)) * (h - pad * 2 || 1);
    return { x, y, v, k: keys[i] };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  const areaD = `${points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ")} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`;

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {[
            ["hours", "Hours"],
            ["days", "Days"],
            ["weeks", "Weeks"],
            ["months", "Months"],
            ["years", "Years"],
          ].map(([k, label]) => (
            <button
              key={k}
              className={`btn ${
                timeframe === k ? "btn-primary" : "btn-outline"
              }`}
              onClick={() => setTimeframe(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="chart-summary">
          <div>
            Total completed:{" "}
            <strong>
              KES {values.reduce((a, b) => a + b, 0).toLocaleString()}
            </strong>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          overflowX: "auto",
          width: "100%",
          border: "1px solid rgba(0,0,0,0.04)",
          borderRadius: 6,
        }}
      >
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width={w}
          height={h}
          preserveAspectRatio="xMinYMid"
        >
          <defs>
            <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(14,165,233,0.14)" />
              <stop offset="100%" stopColor="rgba(16,185,129,0.02)" />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#areaGrad)" stroke="none" />
          <path
            d={pathD}
            fill="none"
            stroke="var(--brand-blue)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((p) => (
            <g key={p.k}>
              <circle
                cx={p.x}
                cy={p.y}
                r={4}
                fill="var(--brand-green)"
                style={{ cursor: "pointer", transition: "r 120ms" }}
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  const clientX =
                    e.clientX || (e.nativeEvent && e.nativeEvent.clientX);
                  const clientY =
                    e.clientY || (e.nativeEvent && e.nativeEvent.clientY);
                  const x = rect ? clientX - rect.left : p.x;
                  const y = rect ? clientY - rect.top : p.y;
                  setTooltip({
                    visible: true,
                    x,
                    y,
                    label: `${labelFor(p.k)}: KES ${p.v.toLocaleString()}`,
                  });
                }}
                onMouseMove={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  const clientX =
                    e.clientX || (e.nativeEvent && e.nativeEvent.clientX);
                  const clientY =
                    e.clientY || (e.nativeEvent && e.nativeEvent.clientY);
                  const x = rect ? clientX - rect.left : p.x;
                  const y = rect ? clientY - rect.top : p.y;
                  setTooltip((t) => ({ ...t, x, y }));
                }}
                onMouseLeave={() =>
                  setTooltip({ visible: false, x: 0, y: 0, label: "" })
                }
              />
            </g>
          ))}

          {/* x labels (sparse) */}
          {points.map((p, i) => {
            const show =
              i === 0 ||
              i === points.length - 1 ||
              i % Math.ceil(Math.max(1, points.length / 6)) === 0;
            return (
              show && (
                <text
                  key={p.k}
                  x={p.x}
                  y={h - 6}
                  fontSize={10}
                  textAnchor="middle"
                  fill="#334155"
                >
                  {labelFor(p.k)}
                </text>
              )
            );
          })}
        </svg>
      </div>

      {/* Tooltip positioned relative to container */}
      {tooltip.visible && (
        <div
          className="chart-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
}
