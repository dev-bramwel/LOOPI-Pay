import { useState, useEffect } from "react";
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

  const getStatusBadge = (status) => {
    const badges = {
      pending: "badge-warning",
      paid: "badge-success",
      failed: "badge-error",
    };
    return badges[status] || "badge-info";
  };

  if (!vendor) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
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
                  <span className="badge badge-warning">Pending Payment</span>
                </div>
              </div>
              <div className="button-group">
                <button className="btn btn-primary" onClick={downloadQR}>
                  Download QR Code
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setGeneratedQR(null)}
                >
                  Generate Another
                </button>
              </div>
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
