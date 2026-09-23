import React from "react";
import { Navigate } from "react-router-dom";
import { selectIsAuthenticated, useAuthStore } from "../../store/authStore";

export default function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
