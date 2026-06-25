import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./Components/FrontEnd/Admin/Dashboard";
import AccountManage from "./Components/FrontEnd/Admin/AccountManage";
import BookManage from "./Components/FrontEnd/Admin/BookManage";
import CouponManage from "./Components/FrontEnd/Admin/CouponManage";
import ServiceManage from "./Components/FrontEnd/Admin/ServiceManage";
import Transaction from "./Components/FrontEnd/Admin/Transaction";
import SettingConfiguration from "./Components/FrontEnd/Admin/SettingConfiguration";
import GuestLayout from "./Components/FrontEnd/Layouts/GuestLayout";
import CustomerLayout from "./Components/FrontEnd/Layouts/CustomerLayout";
import Home from "./Components/FrontEnd/User/Home";
import Login from "./Components/FrontEnd/Shared/Login";
import Register from "./Components/FrontEnd/Shared/Register";
import Blog from "./Components/FrontEnd/User/Blog";
import Book from "./Components/FrontEnd/User/Book";
import CustomerDashboard from "./Components/FrontEnd/User/CustomerDashboard";
import CustomerProfile from "./Components/FrontEnd/User/CustomerProfile";
import CustomerCoupon from "./Components/FrontEnd/User/CustomerCoupon";
import CustomerHistory from "./Components/FrontEnd/User/CustomerHistory";
import CustomerSettings from "./Components/FrontEnd/User/CustomerSettings";
import CustomerCart from "./Components/FrontEnd/User/CustomerCart";
import ScrollToTop from "./Components/FrontEnd/Shared/ScrollToTop";
import AuthProvider from "./context/AuthProvider";
import ProtectedRoute from "./Components/FrontEnd/Shared/ProtectedRoute";
import AboutUs from "./Components/FrontEnd/User/AboutUs";

const withGuestLayout = (component) => <GuestLayout>{component}</GuestLayout>;

const withCustomerLayout = (component) => (
  <CustomerLayout>{component}</CustomerLayout>
);

const App = () => (
  <AuthProvider>
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={withGuestLayout(<Home />)} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/book" element={withGuestLayout(<Book />)} />
        <Route path="/blog" element={withGuestLayout(<Blog />)} />
        <Route path="/about" element={withGuestLayout(<AboutUs />)} />

        <Route
          path="/customer/dashboard"
          element={
            <ProtectedRoute allowedRoles={["customer"]}>
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/profile"
          element={
            <ProtectedRoute allowedRoles={["customer"]}>
              <CustomerProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/coupon"
          element={
            <ProtectedRoute allowedRoles={["customer"]}>
              <CustomerCoupon />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/history"
          element={
            <ProtectedRoute allowedRoles={["customer"]}>
              <CustomerHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/cart"
          element={
            <ProtectedRoute allowedRoles={["customer"]}>
              <CustomerCart />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/settings"
          element={
            <ProtectedRoute allowedRoles={["customer"]}>
              <CustomerSettings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/blog"
          element={
            <ProtectedRoute allowedRoles={["customer"]}>
              {withCustomerLayout(<Blog />)}
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/about"
          element={
            <ProtectedRoute allowedRoles={["customer"]}>
              {withCustomerLayout(<AboutUs />)}
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/book"
          element={
            <ProtectedRoute allowedRoles={["customer"]}>
              {withCustomerLayout(<Book />)}
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/accounts"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AccountManage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/coupons"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <CouponManage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/services"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <ServiceManage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/bookings"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <BookManage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/transactions"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Transaction />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <SettingConfiguration />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  </AuthProvider>
);

export default App;
