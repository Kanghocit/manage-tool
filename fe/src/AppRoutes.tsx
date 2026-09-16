import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

import { AuthBootstrapGate } from "./components/AuthBootstrapGate";
import { AuthenticatedRedirect } from "./components/AuthenticatedRedirect";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuthStore } from "./store/useAuthStore";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ExtensionHandoffPage } from "./pages/auth/ExtensionHandoffPage";
import { DashboardShell } from "./layouts/DashboardShell";
import { CaseStudyQuiz } from "./study/components/CaseStudyQuiz";
import { AdminCaseStudyRoute } from "./study/components/AdminCaseStudyRoute";

function LoginRoute() {
  const user = useAuthStore((state) => state.user);
  if (user) return <AuthenticatedRedirect />;
  return <LoginPage />;
}

function RegisterRoute() {
  const user = useAuthStore((state) => state.user);
  if (user) return <AuthenticatedRedirect />;
  return <RegisterPage />;
}

export function AppRoutes() {
  const bootstrapSession = useAuthStore((state) => state.bootstrapSession);
  const { i18n } = useTranslation();

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  useEffect(() => {
    dayjs.locale(i18n.language === "vi" ? "vi" : "en");
  }, [i18n.language]);

  return (
    <AuthBootstrapGate>
      <BrowserRouter>
        <Routes>
        <Route
          path="/auth/extension"
          element={<ExtensionHandoffPage />}
        />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/register" element={<RegisterRoute />} />
        <Route
          path="/study/cases/:setId/part/:part"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminCaseStudyRoute>
                <CaseStudyQuiz />
              </AdminCaseStudyRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/study/cases/:setId"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminCaseStudyRoute>
                <CaseStudyQuiz />
              </AdminCaseStudyRoute>
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
    </AuthBootstrapGate>
  );
}
