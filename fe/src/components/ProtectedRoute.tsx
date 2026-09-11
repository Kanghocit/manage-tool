import type { ReactNode } from "react";
import { Spin } from "antd";
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
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const user = useAuthStore((state) => state.user);

  if (!hasHydrated) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <Navigate
        to={user.role === "admin" ? "/dashboard" : "/my-license"}
        replace
      />
    );
  }

  return children;
}

