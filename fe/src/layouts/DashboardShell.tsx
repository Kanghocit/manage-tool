import { useMemo } from "react";
import {
  BookOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileTextOutlined,
  KeyOutlined,
  LogoutOutlined,
  SafetyOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Button, Badge, Space, Tooltip } from "antd";
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
import { UserGuidePage } from "../pages/dashboard/UserGuidePage";
import { MyLicensePage } from "../pages/dashboard/MyLicensePage";
import { ProfilePage } from "../pages/dashboard/ProfilePage";
import { AdminLicensesPage } from "../pages/admin/AdminLicensesPage";
import { AdminLicenseCreatePage } from "../pages/admin/AdminLicenseCreatePage";
import { AdminLicenseDetailPage } from "../pages/admin/AdminLicenseDetailPage";
import { AdminUsersPage } from "../pages/admin/AdminUsersPage";
import { AdminLicensePackagesPage } from "../pages/admin/AdminLicensePackagesPage";
import { AdminLicenseRequestsPage } from "../pages/admin/AdminLicenseRequestsPage";
import { AdminSupportPage } from "../pages/admin/AdminSupportPage";
import { UserSupportPage } from "../pages/dashboard/UserSupportPage";
import { useAdminSupportInboxBadge } from "../hooks/useAdminSupportInboxBadge";

export function DashboardShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const { t, i18n } = useTranslation();
  const supportInboxBadge = useAdminSupportInboxBadge();

  const routes = useMemo(() => {
    const base: NavRoute[] = [
      {
        path: "/dashboard",
        icon: <DashboardOutlined />,
        name: t("menu.overview"),
      },
      {
        path: "/guide",
        icon: <BookOutlined />,
        name: t("menu.guide"),
      },
      {
        path: "/my-license",
        icon: <KeyOutlined />,
        name: t("menu.myLicense"),
      },
    ];

    if (user?.role !== "admin") {
      base.push({
        path: "/support",
        icon: <CustomerServiceOutlined />,
        name: t("menu.userSupport"),
      });
    }

    if (user?.role === "admin") {
      base.splice(
        1,
        0,
        {
          path: "/admin/licenses",
          icon: <SafetyOutlined />,
          name: t("menu.licenses"),
        },
        {
          path: "/admin/license-packages",
          icon: <DollarOutlined />,
          name: t("menu.licensePackages"),
        },
        {
          path: "/admin/license-requests",
          icon: <FileTextOutlined />,
          name: t("menu.licenseRequests"),
        },
        {
          path: "/admin/support",
          icon: <CustomerServiceOutlined />,
          name: t("menu.support"),
          badge: supportInboxBadge > 0 ? supportInboxBadge : undefined,
        },
        { path: "/admin/users", icon: <TeamOutlined />, name: t("menu.users") },
      );
    }

    return base;
  }, [supportInboxBadge, t, user?.role]);

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
      menuItemRender={(item, dom) => {
        const showSupportBadge =
          item.path === "/admin/support" && supportInboxBadge > 0;

        return (
          <a
            onClick={(event) => {
              event.preventDefault();
              if (item.path) navigate(item.path as MenuKey);
            }}
            className={showSupportBadge ? "support-menu-item-with-badge" : undefined}
          >
            {dom}
            {showSupportBadge ? (
              <Badge
                count={supportInboxBadge}
                overflowCount={99}
                size="small"
                className="support-menu-badge"
              />
            ) : null}
          </a>
        );
      }}
      layout="mix"
      splitMenus={false}
      fixSiderbar
      breakpoint="md"
      contentStyle={{ padding: 0 }}
    >
      <div className="min-h-screen bg-[#f5f7fb] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0px,env(safe-area-inset-left))] pr-[max(0px,env(safe-area-inset-right))]">
        <div className="mx-auto w-full max-w-[1920px] p-3 sm:p-4 md:p-6">
          <Routes>
            <Route path="/dashboard" element={<OverviewPage />} />
            <Route path="/guide" element={<UserGuidePage />} />
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
              path="/support"
              element={
                <ProtectedRoute>
                  <UserSupportPage />
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
              path="/admin/license-packages"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminLicensePackagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/license-requests"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminLicenseRequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/support/:id?"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminSupportPage />
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
