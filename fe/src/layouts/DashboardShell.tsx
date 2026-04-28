import { useMemo } from "react";
import {
  AppstoreOutlined,
  DashboardOutlined,
  LogoutOutlined,
  SafetyOutlined,
  TeamOutlined,
  ToolOutlined,
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
import { MyToolsPage } from "../pages/dashboard/MyToolsPage";
import { ProfilePage } from "../pages/dashboard/ProfilePage";
import { UsersPage } from "../pages/admin/UsersPage";
import { ToolsPage } from "../pages/admin/ToolsPage";
import { SubscriptionsPage } from "../pages/admin/SubscriptionsPage";

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
      { path: "/my-tools", icon: <ToolOutlined />, name: t("menu.myTools") },
      { path: "/profile", icon: <UserOutlined />, name: t("menu.profile") },
    ];

    if (user?.role === "admin") {
      base.splice(
        1,
        0,
        { path: "/admin/users", icon: <TeamOutlined />, name: t("menu.users") },
        {
          path: "/admin/tools",
          icon: <AppstoreOutlined />,
          name: t("menu.tools"),
        },
        {
          path: "/admin/subscriptions",
          icon: <SafetyOutlined />,
          name: t("menu.subscriptions"),
        },
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
            <Route path="/my-tools" element={<MyToolsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tools"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <ToolsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/subscriptions"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <SubscriptionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="*"
              element={
                <Navigate
                  to={user?.role === "admin" ? "/dashboard" : "/my-tools"}
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
