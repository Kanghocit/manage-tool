import { useCallback, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  List,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined, QrcodeOutlined, DeleteOutlined } from "@ant-design/icons";
import { PageContainer } from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../lib/api";
import { useZaloSocket } from "../../hooks/useZaloSocket";
import type { QrLoginSnapshot, ZaloAccountRow, ZaloWsEvent } from "../../types/zalo";

async function fetchAccounts(): Promise<ZaloAccountRow[]> {
  const res = await api.get<{ data: ZaloAccountRow[] }>("/api/zalo/accounts");
  return res.data.data;
}

export function ZaloAccountsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [qrOpen, setQrOpen] = useState(false);
  const [loginId, setLoginId] = useState<string | null>(null);
  const [qrState, setQrState] = useState<QrLoginSnapshot | null>(null);

  const accountsQuery = useQuery({
    queryKey: ["zalo", "accounts"],
    queryFn: fetchAccounts,
  });

  const onWsEvent = useCallback(
    (event: ZaloWsEvent) => {
      if (event.type === "zalo:qr" && (!loginId || event.loginId === loginId)) {
        setQrState(event);
        if (event.status === "success") {
          void queryClient.invalidateQueries({ queryKey: ["zalo", "accounts"] });
          window.setTimeout(() => {
            setQrOpen(false);
            setLoginId(null);
            setQrState(null);
          }, 1200);
        }
      }
      if (event.type === "zalo:loggedIn") {
        void queryClient.invalidateQueries({ queryKey: ["zalo", "accounts"] });
      }
    },
    [loginId, queryClient],
  );

  useZaloSocket({ enabled: qrOpen, onEvent: onWsEvent });

  const startQr = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: QrLoginSnapshot & { loginId: string } }>(
        "/api/zalo/accounts/qr",
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      setLoginId(data.loginId);
      setQrState(data);
      setQrOpen(true);
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/zalo/accounts/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["zalo", "accounts"] });
    },
  });

  const pollQr = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.get<{ data: QrLoginSnapshot }>(`/api/zalo/accounts/qr/${id}`);
      return res.data.data;
    },
    onSuccess: (data) => setQrState(data),
  });

  const qrImageSrc =
    qrState?.qrImage?.startsWith("data:") || qrState?.qrImage?.startsWith("http")
      ? qrState.qrImage
      : qrState?.qrImage
        ? `data:image/png;base64,${qrState.qrImage}`
        : undefined;

  return (
    <PageContainer
      title={t("zalo.accountsTitle")}
      subTitle={t("zalo.accountsSubtitle")}
      className="zalo-page"
    >
      <Alert
        type="warning"
        showIcon
        className="mb-4 rounded-2xl border-0 shadow-sm"
        message={t("zalo.riskWarning")}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          className="shadow-sm"
          loading={startQr.isPending}
          onClick={() => startQr.mutate()}
        >
          {t("zalo.addAccount")}
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
        <List
          loading={accountsQuery.isLoading}
          dataSource={accountsQuery.data ?? []}
          locale={{ emptyText: t("zalo.noAccounts") }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="del"
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  loading={deleteAccount.isPending}
                  onClick={() => deleteAccount.mutate(item.id)}
                >
                  {t("zalo.removeAccount")}
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar src={item.avatar ?? undefined}>{item.displayName[0]}</Avatar>}
                title={
                  <Space>
                    <span>{item.displayName}</span>
                    <Tag color={item.status === "active" ? "success" : "default"}>
                      {item.status}
                    </Tag>
                  </Space>
                }
                description={`UID: ${item.zaloUid}`}
              />
            </List.Item>
          )}
        />
      </div>

      <Modal
        open={qrOpen}
        title={
          <Space>
            <QrcodeOutlined />
            {t("zalo.qrTitle")}
          </Space>
        }
        footer={[
          qrState?.status === "expired" ? (
            <Button key="retry" type="primary" onClick={() => startQr.mutate()}>
              {t("zalo.regenerateQr")}
            </Button>
          ) : null,
          <Button
            key="close"
            onClick={() => {
              if (loginId) void api.delete(`/api/zalo/accounts/qr/${loginId}`);
              setQrOpen(false);
              setLoginId(null);
              setQrState(null);
            }}
          >
            {t("common.close", "Đóng")}
          </Button>,
        ]}
        onCancel={() => setQrOpen(false)}
        destroyOnClose
      >
        <div className="flex flex-col items-center gap-4 py-2">
          {qrState?.status === "scanned" && (
            <Space>
              <Avatar src={qrState.scannedAvatar} />
              <Typography.Text>{qrState.scannedDisplayName}</Typography.Text>
              <Spin size="small" />
            </Space>
          )}
          {qrImageSrc ? (
            <img
              src={qrImageSrc}
              alt="Zalo QR"
              className="h-64 w-64 rounded-xl border border-slate-200 object-contain p-2"
            />
          ) : (
            <Spin size="large" />
          )}
          <Typography.Text type="secondary">{t("zalo.qrHint")}</Typography.Text>
          {loginId && qrState?.status === "waiting_scan" && (
            <Button size="small" onClick={() => pollQr.mutate(loginId)}>
              {t("zalo.refreshQrState")}
            </Button>
          )}
          {qrState?.status === "error" && (
            <Alert type="error" message={qrState.errorMessage ?? t("zalo.qrError")} />
          )}
        </div>
      </Modal>
    </PageContainer>
  );
}
