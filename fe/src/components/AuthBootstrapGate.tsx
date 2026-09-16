import type { ReactNode } from "react";
import { Spin } from "antd";
import { useAuthStore } from "../store/useAuthStore";

export function AuthBootstrapGate({ children }: { children: ReactNode }) {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

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

  return children;
}
