import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore, type Role } from "../store/useAuthStore";

export function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Role[];
}) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <Navigate
        to={user.role === "admin" ? "/dashboard" : "/my-tools"}
        replace
      />
    );
  }

  return children;
}

