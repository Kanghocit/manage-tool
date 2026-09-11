import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

import { AuthenticatedRedirect } from "./components/AuthenticatedRedirect";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuthStore } from "./store/useAuthStore";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ExtensionHandoffPage } from "./pages/auth/ExtensionHandoffPage";
import { DashboardShell } from "./layouts/DashboardShell";
import { StudyRoutes } from "./study/StudyRoutes";

function LoginRoute() {
  const user = useAuthStore((state) => state.user);
  return user ? <AuthenticatedRedirect /> : <LoginPage />;
}

function RegisterRoute() {
  const user = useAuthStore((state) => state.user);
  return user ? <AuthenticatedRedirect /> : <RegisterPage />;
}

export function AppRoutes() {
  const hydrate = useAuthStore((state) => state.hydrate);
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
          path="/auth/extension"
          element={<ExtensionHandoffPage />}
        />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/register" element={<RegisterRoute />} />
        <Route
          path="/study/*"
          element={
            <ProtectedRoute>
              <StudyRoutes />
            </ProtectedRoute>
          }
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

