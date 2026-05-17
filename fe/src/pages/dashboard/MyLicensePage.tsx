import {
  App as AntApp,
  Alert,
  Button,
  Divider,
  Input,
  Space,
  Tag,
  Typography,
} from "antd";
import { PageContainer, ProCard } from "@ant-design/pro-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";

import { api } from "../../lib/api";
import {
  WEB_DEVICE_ID_STORAGE_KEY,
  getOrCreateWebDeviceId,
  readDeviceIdFromSearchParams,
} from "../../lib/deviceId";

type LicenseMeResponse = {
  success: true;
  license: null | {
    id: string;
    licenseKey: string | null;
    licenseKeyPreview?: string;
    status: "unused" | "active" | "expired" | "blocked";
    expiresAt: string | null;
    durationDays: number | null;
    activatedAt: string | null;
    maxDevices: number;
    devices: {
      id: string;
      deviceId: string;
      deviceName?: string;
      lastSeenAt?: string | null;
    }[];
  };
  purchasedUnusedLicense?: {
    id: string;
    licenseKey: string | null;
    licenseKeyPreview: string;
    durationDays: number | null;
    purchaseOrderId: string | null;
  } | null;
};

export function MyLicensePage() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const [searchParams] = useSearchParams();

  const [licenseKey, setLicenseKey] = useState("");
  const [deviceId, setDeviceId] = useState(() =>
    getOrCreateWebDeviceId(searchParams),
  );

  useEffect(() => {
    const fromQuery = readDeviceIdFromSearchParams(searchParams);
    if (!fromQuery) return;
    setDeviceId((prev: string) => {
      if (fromQuery === prev) return prev;
      localStorage.setItem(WEB_DEVICE_ID_STORAGE_KEY, fromQuery);
      return fromQuery;
    });
  }, [searchParams]);

  const meQuery = useQuery({
    queryKey: ["license-me"],
    queryFn: async (): Promise<LicenseMeResponse> => {
      try {
        return (await api.get<LicenseMeResponse>("/api/license/me")).data;
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
  });

  const purchasedUnused = meQuery.data?.purchasedUnusedLicense;

  useEffect(() => {
    if (purchasedUnused?.licenseKey) {
      setLicenseKey(purchasedUnused.licenseKey);
    }
  }, [purchasedUnused?.licenseKey, purchasedUnused?.id]);

  const activateMutation = useMutation({
    mutationFn: async () => {
      return (
        await api.post("/api/license/activate", {
          licenseKey,
          deviceId,
          deviceName: navigator.platform,
          userAgent: navigator.userAgent,
        })
      ).data as { success: boolean; message?: string; code?: string };
    },
    onSuccess: async (data) => {
      if (data.success) {
        message.success(data.message ?? "Activated");
      } else {
        message.error(
          `${data.code ?? "ERROR"}: ${data.message ?? "Activate failed"}`,
        );
      }
      await meQuery.refetch();
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as
          | { message?: string; code?: string }
          | undefined;
        if (data?.message) {
          message.error(
            data.code ? `${data.code}: ${data.message}` : data.message,
          );
          return;
        }
      }
      message.error(err instanceof Error ? err.message : "Request failed");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post("/api/license/verify", {
          deviceId,
        })
      ).data as {
        success: boolean;
        allowed: boolean;
        code?: string;
        message?: string;
      },
    onSuccess: (data) => {
      if (data.allowed) message.success("allowed=true");
      else
        message.warning(
          `${data.code ?? "DENIED"}: ${data.message ?? "allowed=false"}`,
        );
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as
          | { message?: string; code?: string }
          | undefined;
        if (data?.message) {
          message.error(
            data.code ? `${data.code}: ${data.message}` : data.message,
          );
          return;
        }
      }
      message.error(err instanceof Error ? err.message : "Request failed");
    },
  });

  const statusTag = (status: string) => {
    const color =
      status === "active"
        ? "green"
        : status === "blocked"
          ? "red"
          : status === "expired"
            ? "default"
            : "blue";
    return <Tag color={color}>{status}</Tag>;
  };

  return (
    <PageContainer
      title={t("menu.myLicense")}
      subTitle={t("pages.myLicenseSubtitle")}
    >
      {purchasedUnused ? (
        <Alert
          type="success"
          showIcon
          className="mb-4"
          message={t("pages.purchasedUnusedTitle")}
          description={
            <div className="space-y-2">
              <Typography.Text>
                {t("pages.purchasedUnusedHintShort")}
              </Typography.Text>
              {purchasedUnused.licenseKey ? (
                <div className="rounded-lg border border-emerald-200 bg-white p-3">
                  <Typography.Text type="secondary" className="text-xs">
                    {t("pages.licenseKeyLabel")}
                  </Typography.Text>
                  <div className="mt-1">
                    <Typography.Text code copyable className="text-sm">
                      {purchasedUnused.licenseKey}
                    </Typography.Text>
                  </div>
                </div>
              ) : (
                <Typography.Text type="secondary">
                  {t("pages.purchasedUnusedHint", {
                    preview: purchasedUnused.licenseKeyPreview,
                  })}
                </Typography.Text>
              )}
            </div>
          }
        />
      ) : null}
      <div className="grid grid-equal-rows gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ProCard bordered className="h-full" title={t("pages.activateTitle")}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Alert
              type="info"
              showIcon
              message={t("pages.myLicenseDeviceHint")}
            />
            <div>
              <Typography.Text type="secondary">
                {t("pages.deviceIdLabel")}
              </Typography.Text>
              <div className="mt-1">
                <Typography.Text code copyable>
                  {deviceId}
                </Typography.Text>
              </div>
            </div>

            <Input
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="KANG-ABCD-EFGH-1234"
            />

            <Space wrap>
              <Button
                type="primary"
                loading={activateMutation.isPending}
                onClick={() => activateMutation.mutate()}
                disabled={!licenseKey.trim()}
              >
                {t("pages.activateButton")}
              </Button>
              <Button
                loading={verifyMutation.isPending}
                onClick={() => verifyMutation.mutate()}
              >
                {t("pages.verifyButton")}
              </Button>
              <Button
                onClick={() => meQuery.refetch()}
                loading={meQuery.isFetching}
              >
                {t("pages.refreshButton")}
              </Button>
            </Space>
          </Space>
        </ProCard>

        <ProCard
          bordered
          className="h-full"
          title={t("pages.currentLicenseTitle")}
        >
          {meQuery.isLoading ? (
            <Typography.Text type="secondary">Loading...</Typography.Text>
          ) : meQuery.data?.license ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Typography.Text strong>{t("common.status")}:</Typography.Text>
                {statusTag(meQuery.data.license.status)}
              </div>
              <div>
                <Typography.Text strong className="block mb-1">
                  {t("pages.licenseKeyLabel")}:
                </Typography.Text>
                {meQuery.data.license.licenseKey ? (
                  <Typography.Text code copyable className="text-sm break-all">
                    {meQuery.data.license.licenseKey}
                  </Typography.Text>
                ) : (
                  <Typography.Text type="secondary" className="text-sm">
                    {meQuery.data.license.licenseKeyPreview ?? "—"} (
                    {t("adminLicenses.legacyNoPlain")})
                  </Typography.Text>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Typography.Text strong>
                  {t("pages.maxDevices")}:
                </Typography.Text>
                <Typography.Text>
                  {meQuery.data.license.maxDevices}
                </Typography.Text>
              </div>
              <div className="flex items-center gap-2">
                <Typography.Text strong>
                  {t("pages.expiresAt")}:
                </Typography.Text>
                <Typography.Text>
                  {meQuery.data.license.expiresAt
                    ? dayjs(meQuery.data.license.expiresAt).format(
                        "YYYY-MM-DD HH:mm",
                      )
                    : t("adminLicenses.lifetime")}
                </Typography.Text>
              </div>
              {meQuery.data.license.activatedAt ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Typography.Text strong>
                    {t("pages.activatedAtLabel")}:
                  </Typography.Text>
                  <Typography.Text>
                    {dayjs(meQuery.data.license.activatedAt).format(
                      "YYYY-MM-DD HH:mm",
                    )}
                  </Typography.Text>
                </div>
              ) : null}
              {meQuery.data.license.durationDays != null ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Typography.Text strong>
                    {t("pages.durationDaysLabel")}:
                  </Typography.Text>
                  <Typography.Text>
                    {t("pages.durationDaysValue", {
                      count: meQuery.data.license.durationDays,
                    })}
                  </Typography.Text>
                </div>
              ) : null}
              <Typography.Paragraph type="secondary" className="!mb-0 text-sm">
                {t("pages.licenseValidityExplain")}
              </Typography.Paragraph>
              <Divider />
              <Typography.Text strong>
                {t("pages.devicesTitle")}
              </Typography.Text>
              <div className="space-y-2">
                {meQuery.data.license.devices.length === 0 ? (
                  <Typography.Text type="secondary">-</Typography.Text>
                ) : (
                  meQuery.data.license.devices.map((d) => (
                    <div
                      key={d.id}
                      className={`rounded-xl border p-3 ${
                        d.deviceId === deviceId
                          ? "border-blue-200 bg-blue-50"
                          : "border-slate-100 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Typography.Text code copyable>
                          {d.deviceId}
                        </Typography.Text>
                        <Space size="small">
                          {d.deviceId === deviceId ? (
                            <Tag color="blue">
                              {t("pages.thisBrowserDevice")}
                            </Tag>
                          ) : null}
                          {d.deviceName ? (
                            <Typography.Text type="secondary">
                              {d.deviceName}
                            </Typography.Text>
                          ) : null}
                        </Space>
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        lastSeenAt: {d.lastSeenAt ?? "-"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <Typography.Text type="secondary">
              {t("pages.noLicenseYet")}
            </Typography.Text>
          )}
        </ProCard>
      </div>
    </PageContainer>
  );
}
