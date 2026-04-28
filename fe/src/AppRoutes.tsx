import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuthStore } from "./store/useAuthStore";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { DashboardShell } from "./layouts/DashboardShell";

export function AppRoutes() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const user = useAuthStore((state) => state.user);
  const { i18n } = useTranslation();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    dayjs.locale(i18n.language === "vi" ? "vi" : "en");
  }, [i18n.language]);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <DashboardShell />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

