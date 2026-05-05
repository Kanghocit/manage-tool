import { Button, Statistic, Tag } from "antd";
import {
  BlockOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  KeyOutlined,
  SafetyOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { PageContainer, ProCard } from "@ant-design/pro-components";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

import { api } from "../../lib/api";
import { useAuthStore } from "../../store/useAuthStore";

type AdminDashboardRes = {
  success: boolean;
  stats: {
    users: { total: number; active: number };
    licenses: {
      total: number;
      unused: number;
      active: number;
      expired: number;
      blocked: number;
    };
    activationsActive: number;
  };
};

type LicenseMeRes = {
  success: boolean;
  license: {
    status: string;
    expiresAt: string | null;
    durationDays: number | null;
    activatedAt: string | null;
    maxDevices: number;
    devices: { deviceId: string; lastSeenAt: string | null }[];
  } | null;
};

export function OverviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);

  const adminQuery = useQuery({
    queryKey: ["admin-dashboard"],
    enabled: role === "admin",
    queryFn: async () =>
      (await api.get<AdminDashboardRes>("/api/admin/dashboard")).data.stats,
  });

  const userLicenseQuery = useQuery({
    queryKey: ["license-me-overview"],
    enabled: role === "user",
    queryFn: async () =>
      (await api.get<LicenseMeRes>("/api/license/me")).data.license,
  });

  if (role === "user") {
    const lic = userLicenseQuery.data;
    return (
      <PageContainer
        title={t("menu.overview")}
        subTitle={t("pages.overviewUserSubtitle")}
      >
        <ProCard bordered className="max-w-2xl">
          {userLicenseQuery.isLoading ? (
            <span className="text-slate-500">{t("common.loading")}</span>
          ) : lic ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t("pages.currentLicenseTitle")}</span>
                <Tag
                  color={
                    lic.status === "active"
                      ? "green"
                      : lic.status === "blocked"
                        ? "red"
                        : "default"
                  }
                >
                  {lic.status}
                </Tag>
              </div>
              <div className="text-sm text-slate-600">
                {t("pages.expiresAt")}:{" "}
                {lic.expiresAt
                  ? dayjs(lic.expiresAt).format("YYYY-MM-DD HH:mm")
                  : t("adminLicenses.lifetime")}
              </div>
              {lic.activatedAt ? (
                <div className="text-sm text-slate-600">
                  {t("pages.activatedAtLabel")}:{" "}
                  {dayjs(lic.activatedAt).format("YYYY-MM-DD HH:mm")}
                </div>
              ) : null}
              {lic.durationDays != null ? (
                <div className="text-xs text-slate-500">{t("pages.licenseValidityExplain")}</div>
              ) : null}
              <div className="text-sm text-slate-600">
                {t("pages.maxDevices")}: {lic.maxDevices} · {t("pages.devicesTitle")}:{" "}
                {lic.devices.length}
              </div>
              <Button type="primary" onClick={() => navigate("/my-license")}>
                {t("pages.openMyLicense")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-600">{t("pages.noLicenseYet")}</p>
              <Button type="primary" onClick={() => navigate("/my-license")}>
                {t("pages.openMyLicense")}
              </Button>
            </div>
          )}
        </ProCard>
      </PageContainer>
    );
  }

  const s = adminQuery.data;

  return (
    <PageContainer
      title={t("menu.overview")}
      subTitle={t("pages.overviewSubtitle")}
    >
      {adminQuery.isLoading || !s ? (
        <ProCard bordered>
          <span className="text-slate-500">{t("common.loading")}</span>
        </ProCard>
      ) : (
        <>
          <div className="grid grid-equal-rows gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ProCard bordered className="h-full">
              <Statistic
                title={t("pages.dashboardUsers")}
                value={s.users.total}
                suffix={
                  <span className="text-sm font-normal text-slate-500">
                    ({s.users.active} {t("pages.dashboardActiveUsers")})
                  </span>
                }
                prefix={<TeamOutlined />}
              />
            </ProCard>
            <ProCard bordered className="h-full">
              <Statistic
                title={t("pages.dashboardLicensesTotal")}
                value={s.licenses.total}
                prefix={<KeyOutlined />}
              />
            </ProCard>
            <ProCard bordered className="h-full">
              <Statistic
                title={t("pages.dashboardActivations")}
                value={s.activationsActive}
                prefix={<UserOutlined />}
              />
            </ProCard>
            <ProCard bordered className="h-full">
              <Statistic
                title={t("pages.activeLicenses")}
                value={s.licenses.active}
                prefix={<CheckCircleOutlined />}
              />
            </ProCard>
          </div>

          <div className="mt-4 grid grid-equal-rows gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ProCard bordered className="h-full">
              <Statistic
                title={t("pages.dashboardUnused")}
                value={s.licenses.unused}
                prefix={<ClockCircleOutlined />}
              />
            </ProCard>
            <ProCard bordered className="h-full">
              <Statistic
                title={t("pages.dashboardExpired")}
                value={s.licenses.expired}
                prefix={<ClockCircleOutlined />}
              />
            </ProCard>
            <ProCard bordered className="h-full">
              <Statistic
                title={t("pages.dashboardBlocked")}
                value={s.licenses.blocked}
                prefix={<BlockOutlined />}
              />
            </ProCard>
            <ProCard
              bordered
              className="h-full"
              title={
                <span className="flex items-center gap-2">
                  <SafetyOutlined />
                  {t("pages.dashboardQuickLinks")}
                </span>
              }
            >
              <Button type="primary" block onClick={() => navigate("/admin/licenses")}>
                {t("pages.goToLicenses")}
              </Button>
            </ProCard>
          </div>
        </>
      )}

      <ProCard bordered title={t("pages.adminNotesTitle")} className="mt-4!">
        <ul className="list-disc space-y-2 pl-5 text-slate-600">
          <li>{t("pages.noteOverviewAdmin")}</li>
          <li>{t("pages.noteOverviewUser")}</li>
        </ul>
      </ProCard>
    </PageContainer>
  );
}
