import React from "react";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  return (
    <div
      className="card"
      style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}
    >
      <h1>Reset Password</h1>
      <p>Please contact administrators for assistance. Thank you.</p>
      <div style={{ marginTop: 12 }}>
        <Link to="/vendor/login">
          <button className="btn btn-secondary">Back to Login</button>
        </Link>
      </div>
    </div>
  );
}
