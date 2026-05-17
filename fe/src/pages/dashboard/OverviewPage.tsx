import { useEffect, useRef, useState } from "react";
import {
  App as AntApp,
  Alert,
  Button,
  Modal,
  Statistic,
  Tag,
  Typography,
} from "antd";
import {
  BlockOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  KeyOutlined,
  SafetyOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { PageContainer, ProCard } from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

import { LICENSE_PACKAGES_UI } from "../../config/licensePackages";

const ORDER_EXPIRY_MS = 120 * 1000; // 2 phút

function useOrderCountdown(createdAt: string | undefined) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!createdAt) {
      setSecondsLeft(null);
      return;
    }
    const expiresAt = new Date(createdAt).getTime() + ORDER_EXPIRY_MS;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [createdAt]);

  return secondsLeft;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
import { api } from "../../lib/api";
import type { PackageCode } from "../../types/purchase";
import type { PurchaseOrderDto } from "../../types/purchase";
import { useAuthStore } from "../../store/useAuthStore";

type AdminDashboardRes = {
  success: boolean;
  stats: {
    users: { total: number; active: number; blocked: number };
    licenses: {
      total: number;
      unused: number;
      active: number;
      expired: number;
      blocked: number;
      deleted: number;
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
  /** New key from purchase; still unused until user activates on My License */
  purchasedUnusedLicense: {
    id: string;
    licenseKeyPreview: string;
    durationDays: number | null;
    purchaseOrderId: string | null;
  } | null;
};

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}

function UserOverviewSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = AntApp.useApp();

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const pendingOrderQuery = useQuery({
    queryKey: ["purchase-order-pending"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; order: PurchaseOrderDto | null }>(
        "/api/purchases/pending",
      );
      return res.data.order;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const pendingOrder = pendingOrderQuery.data ?? null;

  const userLicenseQuery = useQuery({
    queryKey: ["license-me-overview"],
    queryFn: async (): Promise<LicenseMeRes> => {
      try {
        return (await api.get<LicenseMeRes>("/api/license/me")).data;
      } catch (e) {
        if (
          axios.isAxiosError(e) &&
          e.response?.status === 404 &&
          (e.response.data as { code?: string })?.code === "NO_LICENSE"
        ) {
          return { success: true, license: null, purchasedUnusedLicense: null };
        }
        throw e;
      }
    },
    refetchOnWindowFocus: true,
  });

  const orderQuery = useQuery({
    queryKey: ["purchase-order", activeOrderId],
    enabled: payModalOpen && !!activeOrderId,
    queryFn: async () => {
      const res = await api.get<{ success: boolean; order: PurchaseOrderDto }>(
        `/api/purchases/${activeOrderId}`,
      );
      return res.data.order;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 5000 : false,
  });

  useEffect(() => {
    if (orderQuery.data?.status === "paid") {
      void queryClient.invalidateQueries({ queryKey: ["license-me-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["license-me"] });
    }
  }, [orderQuery.data?.status, queryClient]);

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await api.delete(`/api/purchases/${orderId}`);
    },
    onSuccess: () => {
      setPayModalOpen(false);
      setActiveOrderId(null);
      void queryClient.invalidateQueries({ queryKey: ["purchase-order-pending"] });
      message.success(t("pages.orderCancelled"));
    },
    onError: () => {
      message.error(t("pages.orderCancelFailed"));
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageCode: PackageCode) => {
      const res = await api.post<{ success: boolean; order: PurchaseOrderDto }>(
        "/api/purchases",
        {
          packageCode,
        },
      );
      return res.data.order;
    },
    onSuccess: (order) => {
      setActiveOrderId(order.id);
      setPayModalOpen(true);
      void queryClient.invalidateQueries({
        queryKey: ["purchase-order", order.id],
      });
      queryClient.setQueryData(["purchase-order", order.id], order);
      message.success(t("pages.purchaseOpened"));
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        const code = (err.response.data as { code?: string }).code;
        if (code === "PKG_1D_ALREADY_PURCHASED") {
          message.warning(t("pages.pkg1dAlreadyPurchased"));
          return;
        }
      }
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const data = err.response.data as {
          order?: PurchaseOrderDto;
          message?: string;
        };
        if (data.order) {
          setActiveOrderId(data.order.id);
          setPayModalOpen(true);
          queryClient.setQueryData(["purchase-order", data.order.id], data.order);
          message.warning(t("pages.pendingOrderReused"));
          return;
        }
      }
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message
        : undefined;
      message.error(typeof msg === "string" ? msg : t("common.loading"));
    },
  });

  const lic = userLicenseQuery.data?.license;
  const purchasedUnused = userLicenseQuery.data?.purchasedUnusedLicense ?? null;
  const order = orderQuery.data;
  const pendingCreatedAt = order?.status === "pending" ? order.createdAt : undefined;
  const pendingBannerCreatedAt =
    pendingOrder?.status === "pending" ? pendingOrder.createdAt : undefined;
  const modalSecondsLeft = useOrderCountdown(pendingCreatedAt);
  const bannerSecondsLeft = useOrderCountdown(pendingBannerCreatedAt);

  // When the modal countdown hits 0, refetch order to confirm expired status.
  useEffect(() => {
    if (modalSecondsLeft === 0) {
      void orderQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["purchase-order-pending"] });
    }
  }, [modalSecondsLeft, orderQuery, queryClient]);
  const pricePerPeriod = (pkg: (typeof LICENSE_PACKAGES_UI)[number]) => {
    if (pkg.period.unit === "month") {
      return Math.round(pkg.amountVnd / pkg.period.months);
    }
    return Math.round(pkg.amountVnd / pkg.period.days);
  };

  return (
    <PageContainer title={t("menu.overview")}>
      {pendingOrder ? (
        <Alert
          type="warning"
          showIcon
          className="mb-6"
          message={
            <span>
              {t("pages.pendingOrderBannerTitle")}
              {bannerSecondsLeft !== null && bannerSecondsLeft > 0 ? (
                <span className="ml-2 font-mono text-sm text-orange-600">
                  {formatCountdown(bannerSecondsLeft)}
                </span>
              ) : null}
            </span>
          }
          description={t("pages.pendingOrderBannerDesc", {
            amount: `${formatVnd(pendingOrder.amountVnd)} ₫`,
            content: pendingOrder.transferContent,
          })}
          action={
            <div className="flex gap-2 mt-1">
              <Button
                size="small"
                type="primary"
                onClick={() => {
                  setActiveOrderId(pendingOrder.id);
                  queryClient.setQueryData(
                    ["purchase-order", pendingOrder.id],
                    pendingOrder,
                  );
                  setPayModalOpen(true);
                }}
              >
                {t("pages.viewOrder")}
              </Button>
              <Button
                size="small"
                danger
                loading={cancelOrderMutation.isPending}
                onClick={() => cancelOrderMutation.mutate(pendingOrder.id)}
              >
                {t("pages.cancelOrder")}
              </Button>
            </div>
          }
        />
      ) : null}

      <Typography.Title level={4} className="mt-0 mb-2">
        {t("pages.purchaseTitle")}
      </Typography.Title>
      <Typography.Paragraph type="secondary" className="mb-6">
        {t("pages.purchaseSubtitle")}
      </Typography.Paragraph>

      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {LICENSE_PACKAGES_UI.map((pkg) => (
          <div
            key={pkg.code}
            className={`flex h-full flex-col rounded-2xl border-2 p-5 shadow-sm ${pkg.theme}`}
          >
            <div className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-800">
              <span aria-hidden>{pkg.icon}</span>
              <span>
                {pkg.period.unit === "month"
                  ? t("pages.packageDuration", { count: pkg.period.months })
                  : t("pages.packageDurationDays", { count: pkg.period.days })}
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {formatVnd(pkg.amountVnd)} ₫
            </div>
            <div className="mb-4 text-sm text-slate-500">
              {pkg.period.unit === "month"
                ? t("pages.perMonthApprox", {
                    amount: `${formatVnd(pricePerPeriod(pkg))} ₫`,
                  })
                : t("pages.perDayApprox", {
                    amount: `${formatVnd(pricePerPeriod(pkg))} ₫`,
                  })}
            </div>
            <ul className="mb-6 flex-1 list-disc space-y-1 pl-4 text-sm text-slate-600">
              {pkg.advantageIds.map((id) => (
                <li key={id}>{t(`pages.${pkg.i18nPrefix}.${id}` as const)}</li>
              ))}
            </ul>
            <Button
              type="primary"
              block
              loading={purchaseMutation.isPending}
              onClick={() => purchaseMutation.mutate(pkg.code)}
            >
              <ShoppingCartOutlined />
              {t("pages.buy")}
            </Button>
          </div>
        ))}
      </div>

      <Typography.Title level={5} className="!mb-3">
        {t("pages.yourLicenseSection")}
      </Typography.Title>
      <ProCard bordered className="max-w-2xl">
        {purchasedUnused ? (
          <Alert
            type="success"
            showIcon
            className="mb-4"
            message={t("pages.purchasedUnusedTitle")}
            description={t("pages.purchasedUnusedHint", {
              preview: purchasedUnused.licenseKeyPreview,
            })}
          />
        ) : null}
        {userLicenseQuery.isLoading ? (
          <span className="text-slate-500">{t("common.loading")}</span>
        ) : lic ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {t("pages.currentLicenseTitle")}
              </span>
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
              <div className="text-xs text-slate-500">
                {t("pages.licenseValidityExplain")}
              </div>
            ) : null}
            <div className="text-sm text-slate-600">
              {t("pages.maxDevices")}: {lic.maxDevices} ·{" "}
              {t("pages.devicesTitle")}: {lic.devices.length}
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

      <Modal
        title={
          <span>
            {t("pages.purchaseModalTitle")}
            {order?.status === "pending" && modalSecondsLeft !== null && modalSecondsLeft > 0 ? (
              <span className="ml-2 font-mono text-sm text-orange-500">
                {formatCountdown(modalSecondsLeft)}
              </span>
            ) : null}
          </span>
        }
        open={payModalOpen}
        onCancel={() => {
          setPayModalOpen(false);
          setActiveOrderId(null);
        }}
        footer={[
          <Button key="close" onClick={() => setPayModalOpen(false)}>
            {t("common.close")}
          </Button>,
          order?.status === "pending" ? (
            <Button
              key="cancel"
              danger
              loading={cancelOrderMutation.isPending}
              onClick={() => {
                if (activeOrderId) cancelOrderMutation.mutate(activeOrderId);
              }}
            >
              {t("pages.cancelOrder")}
            </Button>
          ) : null,
          <Button key="refresh" onClick={() => void orderQuery.refetch()}>
            {t("pages.refreshStatus")}
          </Button>,
        ]}
        width={520}
        destroyOnClose
      >
        {!order ? (
          <span className="text-slate-500">{t("common.loading")}</span>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Tag color={order.status === "paid" ? "green" : "orange"}>
                {order.status === "paid"
                  ? t("pages.orderStatusPaid")
                  : t("pages.orderStatusPending")}
              </Tag>
            </div>
            {order.status === "paid" ? (
              <Typography.Paragraph type="success" className="!mb-0">
                {t("pages.purchasePaid")}
              </Typography.Paragraph>
            ) : modalSecondsLeft === 0 ? (
              <Alert
                type="error"
                showIcon
                className="mb-0"
                message={t("pages.orderExpired")}
              />
            ) : (
              <Typography.Paragraph type="secondary" className="!mb-0">
                {t("pages.purchasePending")}
                {modalSecondsLeft !== null ? (
                  <span className="ml-1 font-mono text-orange-500">
                    ({formatCountdown(modalSecondsLeft)})
                  </span>
                ) : null}
              </Typography.Paragraph>
            )}

            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("pages.amount")}
              </div>
              <div className="text-lg font-semibold">
                {formatVnd(order.amountVnd)} ₫
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("pages.transferContent")}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-slate-100 px-2 py-1 text-sm">
                  {order.transferContent}
                </code>
                <Button
                  size="small"
                  onClick={() => {
                    void navigator.clipboard.writeText(order.transferContent);
                    message.success(t("adminLicenses.copied"));
                  }}
                >
                  {t("adminLicenses.copied")}
                </Button>
              </div>
            </div>

            {order.qrImageUrl ? (
              <div className="text-center">
                <div className="mb-2 text-sm text-slate-600">
                  {t("pages.qrCaption")}
                </div>
                <img
                  src={order.qrImageUrl}
                  alt="VietQR"
                  className="mx-auto max-h-64 rounded-lg border border-slate-200"
                />
              </div>
            ) : (
              <Typography.Text type="warning">
                {t("pages.qrUnavailable")}
              </Typography.Text>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}

function AdminTestPurchaseSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { message } = AntApp.useApp();

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const orderQuery = useQuery({
    queryKey: ["purchase-order", activeOrderId],
    enabled: payModalOpen && !!activeOrderId,
    queryFn: async () => {
      const res = await api.get<{ success: boolean; order: PurchaseOrderDto }>(
        `/api/purchases/${activeOrderId}`,
      );
      return res.data.order;
    },
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 5000 : false,
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await api.delete(`/api/purchases/${orderId}`);
    },
    onSuccess: () => {
      setPayModalOpen(false);
      setActiveOrderId(null);
      message.success(t("pages.orderCancelled"));
    },
    onError: () => message.error(t("pages.orderCancelFailed")),
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageCode: PackageCode) => {
      const res = await api.post<{ success: boolean; order: PurchaseOrderDto }>(
        "/api/purchases",
        { packageCode },
      );
      return res.data.order;
    },
    onSuccess: (order) => {
      setActiveOrderId(order.id);
      setPayModalOpen(true);
      queryClient.setQueryData(["purchase-order", order.id], order);
      message.success(t("pages.purchaseOpened"));
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const data = err.response.data as { order?: PurchaseOrderDto };
        if (data.order) {
          setActiveOrderId(data.order.id);
          setPayModalOpen(true);
          queryClient.setQueryData(["purchase-order", data.order.id], data.order);
          message.warning(t("pages.pendingOrderReused"));
          return;
        }
      }
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
      message.error(typeof msg === "string" ? msg : t("common.loading"));
    },
  });

  const order = orderQuery.data;
  const adminPackages = LICENSE_PACKAGES_UI.filter((p) => p.code === "PKG_1D");
  const modalSecondsLeft = useOrderCountdown(
    order?.status === "pending" ? order.createdAt : undefined,
  );

  useEffect(() => {
    if (modalSecondsLeft === 0) {
      void orderQuery.refetch();
    }
  }, [modalSecondsLeft, orderQuery]);

  return (
    <>
      <ProCard
        bordered
        title={
          <span className="flex items-center gap-2">
            <ShoppingCartOutlined />
            {t("pages.adminTestPurchaseTitle")}
          </span>
        }
        className="mt-4!"
      >
        <p className="mb-4 text-sm text-slate-500">
          {t("pages.adminTestPurchaseHint")}
        </p>
        <div className="flex flex-wrap gap-3">
          {adminPackages.map((pkg) => (
            <Button
              key={pkg.code}
              icon={<span>{pkg.icon}</span>}
              loading={purchaseMutation.isPending}
              onClick={() => purchaseMutation.mutate(pkg.code)}
            >
              {pkg.period.unit === "month"
                ? t("pages.packageDuration", { count: pkg.period.months })
                : t("pages.packageDurationDays", { count: pkg.period.days })}{" "}
              — {formatVnd(pkg.amountVnd)} ₫
            </Button>
          ))}
        </div>
      </ProCard>

      <Modal
        title={
          <span>
            {t("pages.purchaseModalTitle")}
            {order?.status === "pending" &&
            modalSecondsLeft !== null &&
            modalSecondsLeft > 0 ? (
              <span className="ml-2 font-mono text-sm text-orange-500">
                {formatCountdown(modalSecondsLeft)}
              </span>
            ) : null}
          </span>
        }
        open={payModalOpen}
        onCancel={() => {
          setPayModalOpen(false);
          setActiveOrderId(null);
        }}
        footer={[
          <Button key="close" onClick={() => setPayModalOpen(false)}>
            {t("common.close")}
          </Button>,
          order?.status === "pending" ? (
            <Button
              key="cancel"
              danger
              loading={cancelOrderMutation.isPending}
              onClick={() => {
                if (activeOrderId) cancelOrderMutation.mutate(activeOrderId);
              }}
            >
              {t("pages.cancelOrder")}
            </Button>
          ) : null,
          <Button key="refresh" onClick={() => void orderQuery.refetch()}>
            {t("pages.refreshStatus")}
          </Button>,
        ]}
        width={520}
        destroyOnClose
      >
        {!order ? (
          <span className="text-slate-500">{t("common.loading")}</span>
        ) : (
          <div className="space-y-4">
            <Tag color={order.status === "paid" ? "green" : "orange"}>
              {order.status === "paid"
                ? t("pages.orderStatusPaid")
                : t("pages.orderStatusPending")}
            </Tag>
            {order.status === "paid" ? (
              <Typography.Paragraph type="success" className="!mb-0">
                {t("pages.purchasePaid")}
              </Typography.Paragraph>
            ) : modalSecondsLeft === 0 ? (
              <Alert type="error" showIcon message={t("pages.orderExpired")} />
            ) : (
              <Typography.Paragraph type="secondary" className="!mb-0">
                {t("pages.purchasePending")}
                {modalSecondsLeft !== null ? (
                  <span className="ml-1 font-mono text-orange-500">
                    ({formatCountdown(modalSecondsLeft)})
                  </span>
                ) : null}
              </Typography.Paragraph>
            )}
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("pages.transferContent")}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-slate-100 px-2 py-1 text-sm">
                  {order.transferContent}
                </code>
                <Button
                  size="small"
                  onClick={() => {
                    void navigator.clipboard.writeText(order.transferContent);
                    message.success(t("adminLicenses.copied"));
                  }}
                >
                  {t("adminLicenses.copied")}
                </Button>
              </div>
            </div>
            {order.qrImageUrl ? (
              <div className="text-center">
                <img
                  src={order.qrImageUrl}
                  alt="QR"
                  className="mx-auto max-h-56 rounded-lg border border-slate-200"
                />
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </>
  );
}

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

  if (role === "user") {
    return <UserOverviewSection />;
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
                    ({s.users.active} {t("pages.dashboardActiveUsers")},{" "}
                    {s.users.blocked} {t("pages.dashboardBlockedUsers")})
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
            <ProCard bordered className="h-full">
              <Statistic
                title={t("pages.dashboardDeletedLicenses")}
                value={s.licenses.deleted}
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
              <Button
                type="primary"
                block
                onClick={() => navigate("/admin/licenses")}
              >
                {t("pages.goToLicenses")}
              </Button>
            </ProCard>
          </div>
        </>
      )}

      <AdminTestPurchaseSection />

      <ProCard bordered title={t("pages.adminNotesTitle")} className="mt-4!">
        <ul className="list-disc space-y-2 pl-5 text-slate-600">
          <li>{t("pages.noteOverviewAdmin")}</li>
          <li>{t("pages.noteOverviewUser")}</li>
        </ul>
      </ProCard>
    </PageContainer>
  );
}
