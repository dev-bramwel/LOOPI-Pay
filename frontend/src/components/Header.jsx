import React from "react";
import { Link } from "react-router-dom";

function readVendorData() {
  try {
    const raw =
      localStorage.getItem("vendorData") ||
      sessionStorage.getItem("vendorData");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export default function Header() {
  const vendor = readVendorData();

  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo" aria-hidden />
        <h3>LOOPI++</h3>
      </div>
      <nav className="topnav">
        {vendor && vendor.is_staff ? (
          <Link to="/admin-panel" className="nav-link">
            Admin
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
