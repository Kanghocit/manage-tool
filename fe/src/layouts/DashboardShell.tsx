import { useMemo } from "react";
import {
  DashboardOutlined,
  KeyOutlined,
  LogoutOutlined,
  SafetyOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Button, Space, Tooltip } from "antd";
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
import { AdminUsersPage } from "../pages/admin/AdminUsersPage";

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
      avatarProps={{
        title: (
          <span>
            {user?.fullName}
            <span className="text-slate-400"> </span>
          </span>
        ),
        icon: <UserOutlined />,

        render: (_props, defaultDom) => (
          <div
            role="button"
            tabIndex={0}
            className="flex cursor-pointer items-center"
            onClick={() => navigate("/profile")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate("/profile");
              }
            }}
          >
            {defaultDom}
          </div>
        ),
      }}
      actionsRender={() => {
        const lang = i18n.resolvedLanguage || i18n.language;
        return (
          <Space size={4}>
            <Tooltip title={t("common.langVi")}>
              <Button
                type={lang.startsWith("vi") ? "primary" : "default"}
                size="small"
                aria-label={t("common.langVi")}
                onClick={() => i18n.changeLanguage("vi")}
                className="min-w-10 px-2 text-base leading-none"
              >
                🇻🇳
              </Button>
            </Tooltip>
            <Tooltip title={t("common.langEn")}>
              <Button
                type={lang.startsWith("en") ? "primary" : "default"}
                size="small"
                aria-label={t("common.langEn")}
                onClick={() => i18n.changeLanguage("en")}
                className="min-w-10 px-2 text-base leading-none"
              >
                🇬🇧
              </Button>
            </Tooltip>
          </Space>
        );
      }}
      menuFooterRender={() => (
        <div className="border-t border-slate-200 px-2 py-3">
          <Button
            block
            type="text"
            danger
            icon={<LogoutOutlined />}
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            {t("common.logout")}
          </Button>
        </div>
      )}
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
                  <AdminUsersPage />
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
