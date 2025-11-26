import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import Header from "./components/Header";
import VendorRegister from "./components/VendorRegister";
import VendorLogin from "./components/VendorLogin";
import VendorDashboard from "./components/VendorDashboard";
import VerifyEmail from "./components/VerifyEmail";
import VendorAccount from "./components/VendorAccount";
import Footer from "./components/Footer";
import PayRedirect from "./PayRedirect";
import PaymentCallback from "./PaymentCallback";

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
      <Route path="/vendor/account" element={<VendorAccount />} />
      <Route
        path="/vendor/verify"
        element={<VerifyEmail setIsVendor={() => {}} />}
      />
      <Route
        path="/vendor/dashboard"
        element={<VendorDashboard handleLogout={handleLogout} />}
      />
      <Route path="/pay" element={<PayRedirect />} />
      <Route path="/payment-callback" element={<PaymentCallback />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <div className="container">
          <Header />

          <main>
            <AppWrapper />
          </main>
          <Footer />
        </div>
      </div>
    </BrowserRouter>
  );
}
