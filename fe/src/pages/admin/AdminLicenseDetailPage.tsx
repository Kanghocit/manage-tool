import {
  App as AntApp,
  Alert,
  Button,
  Card,
  Descriptions,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { PageContainer } from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";

import { api } from "../../lib/api";
import { licenseStatusColor, licenseStatusLabel } from "../../lib/statusLabels";
import { useIsMobile } from "../../hooks/useIsMobile";

type LicenseDetail = {
  id: string;
  licenseKey: string | null;
  licenseKeyPreview: string;
  status: string;
  durationDays: number | null;
  expiresAt: string | null;
  maxDevices: number;
  notes: string | null;
  activatedBy: { id: string; email: string } | null;
  activatedAt: string | null;
  devices: {
    id: string;
    deviceId: string;
    deviceName: string | null;
    lastIp: string | null;
    activatedAt: string;
    lastSeenAt: string | null;
    revokedAt: string | null;
  }[];
};

export function AdminLicenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [extendOpen, setExtendOpen] = useState(false);
  const [extraDays, setExtraDays] = useState(30);

  const detailQuery = useQuery({
    queryKey: ["admin-license", id],
    enabled: Boolean(id),
    queryFn: async () =>
      (
        await api.get<{ success: boolean; license: LicenseDetail }>(
          `/api/admin/licenses/${id}`,
        )
      ).data.license,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-license", id] });
  };

  const blockMut = useMutation({
    mutationFn: () => api.patch(`/api/admin/licenses/${id}/block`, {}),
    onSuccess: () => {
      message.success(t("adminLicenses.blocked"));
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const unblockMut = useMutation({
    mutationFn: () => api.patch(`/api/admin/licenses/${id}/unblock`, {}),
    onSuccess: () => {
      message.success(t("adminLicenses.unblocked"));
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const extendMut = useMutation({
    mutationFn: () =>
      api.patch(`/api/admin/licenses/${id}/extend`, { extraDays }),
    onSuccess: () => {
      message.success(t("adminLicenses.extended"));
      setExtendOpen(false);
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (activationId: string) =>
      api.delete(`/api/admin/licenses/${id}/devices/${activationId}`),
    onSuccess: () => {
      message.success(t("adminLicenses.deviceRevoked"));
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/api/admin/licenses/${id}`),
    onSuccess: () => {
      message.success(t("adminLicenses.deleted"));
      void queryClient.invalidateQueries({ queryKey: ["admin-licenses"] });
      navigate("/admin/licenses");
    },
    onError: (e: Error) => message.error(e.message),
  });

  const lic = detailQuery.data;
  const isMobile = useIsMobile();

  const statusColor = licenseStatusColor;

  return (
    <PageContainer
      title={t("adminLicenses.detailTitle")}
      loading={detailQuery.isLoading}
      onBack={() => navigate("/admin/licenses")}
      extra={
        lic ? (
          <div
            className={
              isMobile
                ? "admin-mobile-actions flex w-full min-w-[200px] flex-col gap-2"
                : undefined
            }
          >
            <Space wrap={!isMobile} direction={isMobile ? "vertical" : "horizontal"} className={isMobile ? "w-full" : undefined}>
              <Button block={isMobile} onClick={() => setExtendOpen(true)}>
                {t("adminLicenses.extend")}
              </Button>
              <Popconfirm
                title={t("adminLicenses.confirmDelete")}
                onConfirm={() => deleteMut.mutate()}
              >
                <Button block={isMobile} danger loading={deleteMut.isPending}>
                  {t("adminLicenses.delete")}
                </Button>
              </Popconfirm>
              {lic.status !== "blocked" ? (
                <Popconfirm
                  title={t("adminLicenses.confirmBlock")}
                  onConfirm={() => blockMut.mutate()}
                >
                  <Button block={isMobile} danger loading={blockMut.isPending}>
                    {t("adminLicenses.block")}
                  </Button>
                </Popconfirm>
              ) : (
                <Popconfirm
                  title={t("adminLicenses.confirmUnblock")}
                  onConfirm={() => unblockMut.mutate()}
                >
                  <Button block={isMobile} type="primary" loading={unblockMut.isPending}>
                    {t("adminLicenses.unblock")}
                  </Button>
                </Popconfirm>
              )}
            </Space>
          </div>
        ) : null
      }
    >
      {lic ? (
        <>
          <Descriptions
            bordered
            column={1}
            size="small"
            className="mb-4 bg-white"
          >
            <Descriptions.Item label={t("adminLicenses.fullKey")}>
              {lic.licenseKey ? (
                <Typography.Text code copyable>
                  {lic.licenseKey}
                </Typography.Text>
              ) : (
                <span className="text-slate-500">
                  {lic.licenseKeyPreview} — {t("adminLicenses.legacyNoPlain")}
                </span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t("adminLicenses.preview")}>
              {lic.licenseKeyPreview}
            </Descriptions.Item>
            <Descriptions.Item label={t("common.status")}>
              <Tag color={statusColor(lic.status)}>
                {licenseStatusLabel(lic.status, t)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t("pages.maxDevices")}>
              {lic.maxDevices}
            </Descriptions.Item>
            <Descriptions.Item label={t("adminLicenses.durationDays")}>
              {lic.durationDays == null
                ? t("adminLicenses.lifetime")
                : lic.durationDays}
            </Descriptions.Item>
            <Descriptions.Item label={t("pages.expiresAt")}>
              {lic.expiresAt
                ? dayjs(lic.expiresAt).format("YYYY-MM-DD HH:mm")
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("adminLicenses.activatedBy")}>
              {lic.activatedBy?.email ?? "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("adminLicenses.activatedAt")}>
              {lic.activatedAt
                ? dayjs(lic.activatedAt).format("YYYY-MM-DD HH:mm")
                : "-"}
            </Descriptions.Item>
            {lic.notes ? (
              <Descriptions.Item label={t("adminLicenses.notes")}>
                {lic.notes}
              </Descriptions.Item>
            ) : null}
          </Descriptions>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-2 font-medium">{t("pages.devicesTitle")}</div>
            {isMobile ? (
              <List
                dataSource={lic.devices}
                renderItem={(row) => (
                  <List.Item className="!px-0">
                    <Card size="small" className="admin-mobile-card w-full">
                      <div className="mb-1 font-mono text-xs break-all">{row.deviceId}</div>
                      {row.deviceName ? (
                        <div className="mb-1 text-sm text-slate-600">{row.deviceName}</div>
                      ) : null}
                      {row.lastIp ? (
                        <div className="mb-1 text-sm text-slate-600">IP: {row.lastIp}</div>
                      ) : null}
                      <div className="mb-1 text-xs text-slate-500">
                        {t("adminLicenses.activatedAt")}:{" "}
                        {dayjs(row.activatedAt).format("YYYY-MM-DD HH:mm")}
                      </div>
                      <div className="mb-2">
                        {row.revokedAt ? (
                          <Tag>{t("adminLicenses.revoked")}</Tag>
                        ) : (
                          <Tag color="green">{t("common.active")}</Tag>
                        )}
                      </div>
                      {!row.revokedAt ? (
                        <Popconfirm
                          title={t("adminLicenses.confirmRevoke")}
                          onConfirm={() => revokeMut.mutate(row.id)}
                        >
                          <Button block danger loading={revokeMut.isPending} className="admin-mobile-actions">
                            {t("adminLicenses.revoke")}
                          </Button>
                        </Popconfirm>
                      ) : null}
                    </Card>
                  </List.Item>
                )}
              />
            ) : (
            <Table
              rowKey="id"
              size="small"
              dataSource={lic.devices}
              pagination={false}
              scroll={{ x: "max-content" }}
              columns={[
                {
                  title: "deviceId",
                  dataIndex: "deviceId",
                  render: (v: string) => (
                    <span className="font-mono text-xs">{v}</span>
                  ),
                },
                {
                  title: t("adminLicenses.deviceName"),
                  dataIndex: "deviceName",
                },
                { title: "IP", dataIndex: "lastIp" },
                {
                  title: t("adminLicenses.activatedAt"),
                  dataIndex: "activatedAt",
                  render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm"),
                },
                {
                  title: "lastSeenAt",
                  dataIndex: "lastSeenAt",
                  render: (v: string | null) =>
                    v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "-",
                },
                {
                  title: t("common.status"),
                  render: (_, row) =>
                    row.revokedAt ? (
                      <Tag>{t("adminLicenses.revoked")}</Tag>
                    ) : (
                      <Tag color="green">{t("common.active")}</Tag>
                    ),
                },
                {
                  title: t("common.actions"),
                  render: (_, row) =>
                    row.revokedAt ? null : (
                      <Popconfirm
                        title={t("adminLicenses.confirmRevoke")}
                        onConfirm={() => revokeMut.mutate(row.id)}
                      >
                        <Button
                          type="link"
                          danger
                          size="small"
                          loading={revokeMut.isPending}
                        >
                          {t("adminLicenses.revoke")}
                        </Button>
                      </Popconfirm>
                    ),
                },
              ]}
            />
            )}
          </div>
        </>
      ) : null}

      <Modal
        title={t("adminLicenses.extend")}
        open={extendOpen}
        onCancel={() => setExtendOpen(false)}
        onOk={() => extendMut.mutate()}
        confirmLoading={extendMut.isPending}
        style={{ maxWidth: "calc(100vw - 32px)" }}
        width={isMobile ? "100%" : 520}
      >
        <Alert
          type="info"
          showIcon
          className="mb-3"
          message={t("adminLicenses.extendFromNowHint")}
        />
        <div className="mb-2 text-sm text-slate-600">
          {t("adminLicenses.extraDays")}
        </div>
        <InputNumber
          min={1}
          max={3650}
          value={extraDays}
          onChange={(v) => setExtraDays(typeof v === "number" ? v : 1)}
          className="w-full"
        />
      </Modal>
    </PageContainer>
  );
}
