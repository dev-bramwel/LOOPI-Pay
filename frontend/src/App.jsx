import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import VendorRegister from "./components/VendorRegister";
import VendorLogin from "./components/VendorLogin";
import VendorDashboard from "./components/VendorDashboard";
import VerifyEmail from "./components/VerifyEmail";

function AppWrapper() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("vendorToken");
    localStorage.removeItem("vendorRefreshToken");
    localStorage.removeItem("vendorData");
    navigate("/vendor/login");
  };

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/vendor/register" replace />} />
      <Route path="/vendor/register" element={<VendorRegister />} />
      <Route path="/vendor/login" element={<VendorLogin />} />
      <Route
        path="/vendor/verify"
        element={<VerifyEmail setIsVendor={() => {}} />}
      />
      <Route
        path="/vendor/dashboard"
        element={<VendorDashboard handleLogout={handleLogout} />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppWrapper />
    </BrowserRouter>
  );
}
import { useState, useEffect } from "react";
