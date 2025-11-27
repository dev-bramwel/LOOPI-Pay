import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import LineChart from "./LineChart";

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
                s === "completed ✅"
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
              <div className="alert alert-success">✅ Scan me for payment!</div>
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
                Completed Payments (select timeframe). Watch your business grow!
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
