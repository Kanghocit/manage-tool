import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuthStore } from "../../store/useAuthStore";

type Props = {
  children: ReactNode;
};

export function AdminCaseStudyRoute({ children }: Props) {
  const role = useAuthStore((s) => s.user?.role);
  if (role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
