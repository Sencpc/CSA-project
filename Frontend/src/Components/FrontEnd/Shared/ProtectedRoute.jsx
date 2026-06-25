import { Navigate, useLocation } from "react-router-dom";
import { ROLE_REDIRECTS, useAuth } from "../../../context/AuthContext";

const normalizeRole = (role) => role?.toLowerCase?.();

const ProtectedRoute = ({ children, allowedRoles, redirectTo = "/login" }) => {
  const { isAuthenticated, initializing, user } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-gray-500">
        Checking permissions...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate to={redirectTo} replace state={{ from: location.pathname }} />
    );
  }

  if (allowedRoles?.length) {
    const normalizedAllowed = allowedRoles.map((role) => role.toLowerCase());
    const userRole = normalizeRole(user?.role);

    if (!normalizedAllowed.includes(userRole)) {
      const fallback = ROLE_REDIRECTS[userRole] || "/";
      return <Navigate to={fallback} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
