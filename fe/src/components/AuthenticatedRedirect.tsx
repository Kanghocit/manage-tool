import { Navigate, useLocation } from "react-router-dom";

import { sanitizeAppRedirect } from "../lib/safeRedirect";
import { useAuthStore } from "../store/useAuthStore";

export function AuthenticatedRedirect() {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    return null;
  }

  const from = (location.state as { from?: { pathname?: string } } | null)?.from
    ?.pathname;
  const fallback = user.role === "admin" ? "/dashboard" : "/my-license";

  return <Navigate to={sanitizeAppRedirect(from, fallback)} replace />;
}
