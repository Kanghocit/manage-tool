import { useMemo } from "react";
import {
  DashboardOutlined,
  KeyOutlined,
  LogoutOutlined,
  SafetyOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Button } from "antd";
import { ProLayout } from "@ant-design/pro-components";
import {
  Route,
  Routes,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useTranslation } from "react-i18next";

import { ProtectedRoute } from "../components/ProtectedRoute";
import type { MenuKey, NavRoute } from "../types/nav";
import { useAuthStore } from "../store/useAuthStore";

import { OverviewPage } from "../pages/dashboard/OverviewPage";
import { MyLicensePage } from "../pages/dashboard/MyLicensePage";
import { ProfilePage } from "../pages/dashboard/ProfilePage";
import { AdminLicensesPage } from "../pages/admin/AdminLicensesPage";
import { AdminLicenseCreatePage } from "../pages/admin/AdminLicenseCreatePage";
import { AdminLicenseDetailPage } from "../pages/admin/AdminLicenseDetailPage";

export function DashboardShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const { t, i18n } = useTranslation();

  const routes = useMemo(() => {
    const base: NavRoute[] = [
      {
        path: "/dashboard",
        icon: <DashboardOutlined />,
        name: t("menu.overview"),
      },
      {
        path: "/my-license",
        icon: <KeyOutlined />,
        name: t("menu.myLicense"),
      },
      { path: "/profile", icon: <UserOutlined />, name: t("menu.profile") },
    ];

    if (user?.role === "admin") {
      base.splice(
        1,
        0,
        {
          path: "/admin/licenses",
          icon: <SafetyOutlined />,
          name: t("menu.licenses"),
        },
        { path: "/admin/users", icon: <TeamOutlined />, name: t("menu.users") },
      );
    }

    return base;
  }, [t, user?.role]);

  return (
    <ProLayout
      title={t("app.title")}
      location={{ pathname: location.pathname }}
      route={{ routes }}
      avatarProps={{ title: user?.fullName, icon: <UserOutlined /> }}
      actionsRender={() => [
        <Button
          key="logout"
          icon={<LogoutOutlined />}
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
        >
          {t("common.logout")}
        </Button>,
        <Button
          key="lang"
          onClick={() =>
            i18n.changeLanguage(i18n.language === "vi" ? "en" : "vi")
          }
        >
          {i18n.language === "vi"
            ? t("common.switchToEn")
            : t("common.switchToVi")}
        </Button>,
      ]}
      menuItemRender={(item, dom) => (
        <a
          onClick={(event) => {
            event.preventDefault();
            if (item.path) navigate(item.path as MenuKey);
          }}
        >
          {dom}
        </a>
      )}
      layout="mix"
      splitMenus={false}
      fixSiderbar
      contentStyle={{ padding: 0 }}
    >
      <div className="min-h-screen bg-[#f5f7fb]">
        <div className="mx-auto max-w-[1600px] p-6">
          <Routes>
            <Route path="/dashboard" element={<OverviewPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route
              path="/my-license"
              element={
                <ProtectedRoute>
                  <MyLicensePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/licenses/create"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminLicenseCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/licenses/:id"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminLicenseDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/licenses"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminLicensesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <PlaceholderPage titleKey="menu.users" />
                </ProtectedRoute>
              }
            />
            <Route
              path="*"
              element={
                <Navigate
                  to={user?.role === "admin" ? "/dashboard" : "/my-license"}
                  replace
                />
              }
            />
          </Routes>
        </div>
      </div>
    </ProLayout>
  );
}

function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm">
      <h2 className="mb-2 text-xl font-semibold">{t(titleKey)}</h2>
      <p className="text-slate-500">{t("pages.placeholderBody")}</p>
    </div>
  );
}
