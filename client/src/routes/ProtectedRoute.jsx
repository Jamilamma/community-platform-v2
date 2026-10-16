import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Frontend route guard is for UX only — the backend re-checks role on every request.
export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
