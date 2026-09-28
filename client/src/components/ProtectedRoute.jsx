import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "32px", maxWidth: "800px", margin: "0 auto" }}>
        <div className="skeleton" style={{ height: "32px", width: "40%" }} />
        <div className="skeleton" style={{ height: "120px", width: "100%" }} />
        <div className="skeleton" style={{ height: "80px", width: "100%" }} />
        <div className="skeleton" style={{ height: "80px", width: "100%" }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
