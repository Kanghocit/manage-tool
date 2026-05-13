import { App as AntApp, Button, Popconfirm, Tag, Tooltip } from "antd";
import { PageContainer, ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ActionType } from "@ant-design/pro-components";
import dayjs from "dayjs";

import { api } from "../../lib/api";
import { useAuthStore } from "../../store/useAuthStore";

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "user";
  status: "active" | "blocked";
  createdAt: string;
  registeredDeviceId: string | null;
};

export function AdminUsersPage() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const currentUser = useAuthStore((s) => s.user);
  const actionRef = useRef<ActionType | null>(null);

  const blockMut = useMutation({
    mutationFn: (userId: string) => api.patch(`/api/admin/users/${userId}/block`, {}),
    onSuccess: () => {
      message.success(t("adminUsers.blocked"));
      actionRef.current?.reload();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const unblockMut = useMutation({
    mutationFn: (userId: string) => api.patch(`/api/admin/users/${userId}/unblock`, {}),
    onSuccess: () => {
      message.success(t("adminUsers.unblocked"));
      actionRef.current?.reload();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const resetDeviceMut = useMutation({
    mutationFn: (userId: string) =>
      api.patch(`/api/admin/users/${userId}/reset-device`, {}),
    onSuccess: () => {
      message.success(t("adminUsers.deviceReset"));
      actionRef.current?.reload();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const statusColor = (s: UserRow["status"]) => (s === "active" ? "green" : "red");

  const columns: ProColumns<UserRow>[] = [
    {
      title: "#",
      width: 48,
      search: false,
      render: (_, __, i) => i + 1,
    },
    {
      title: t("adminUsers.email"),
      dataIndex: "email",
      search: false,
      ellipsis: true,
    },
    {
      title: t("adminUsers.fullName"),
      dataIndex: "fullName",
      search: false,
      ellipsis: true,
    },
    {
      title: t("adminUsers.search"),
      dataIndex: "keyword",
      hideInTable: true,
    },
    {
      title: t("adminUsers.role"),
      dataIndex: "role",
      valueType: "select",
      valueEnum: {
        admin: { text: t("roles.admin") },
        user: { text: t("roles.user") },
      },
      render: (_, row) => t(`roles.${row.role}`),
    },
    {
      title: t("common.status"),
      dataIndex: "status",
      valueType: "select",
      valueEnum: {
        active: { text: t("common.active") },
        blocked: { text: t("adminUsers.blockedStatus") },
      },
      render: (_, row) => <Tag color={statusColor(row.status)}>{row.status}</Tag>,
    },
    {
      title: t("adminUsers.device"),
      dataIndex: "registeredDeviceId",
      search: false,
      width: 130,
      render: (_, row) =>
        row.registeredDeviceId ? (
          <Tooltip title={row.registeredDeviceId}>
            <Tag color="blue">{t("adminUsers.deviceBound")}</Tag>
          </Tooltip>
        ) : (
          <Tag>{t("adminUsers.deviceNone")}</Tag>
        ),
    },
    {
      title: t("adminUsers.createdAt"),
      dataIndex: "createdAt",
      search: false,
      render: (_, row) => dayjs(row.createdAt).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: t("common.actions"),
      valueType: "option",
      width: 240,
      search: false,
      render: (_, row) => {
        const isSelf = currentUser?.id === row.id;
        const actions: React.ReactNode[] = [];

        if (row.status === "blocked") {
          actions.push(
            <Popconfirm
              key="unblock"
              title={t("adminUsers.confirmUnblock")}
              onConfirm={() => unblockMut.mutate(row.id)}
            >
              <Button type="link" loading={unblockMut.isPending}>
                {t("adminUsers.unblock")}
              </Button>
            </Popconfirm>,
          );
        } else {
          actions.push(
            <Popconfirm
              key="block"
              title={isSelf ? t("adminUsers.cannotBlockSelf") : t("adminUsers.confirmBlock")}
              onConfirm={() => blockMut.mutate(row.id)}
              disabled={isSelf}
            >
              <Button type="link" danger disabled={isSelf} loading={blockMut.isPending}>
                {t("adminUsers.block")}
              </Button>
            </Popconfirm>,
          );
        }

        if (row.registeredDeviceId) {
          actions.push(
            <Popconfirm
              key="reset-device"
              title={t("adminUsers.confirmResetDevice")}
              onConfirm={() => resetDeviceMut.mutate(row.id)}
            >
              <Button type="link" loading={resetDeviceMut.isPending}>
                {t("adminUsers.resetDevice")}
              </Button>
            </Popconfirm>,
          );
        }

        return actions;
      },
    },
  ];

  return (
    <PageContainer title={t("menu.users")}>
      <ProTable<UserRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        cardBordered
        request={async (params) => {
          const page = params.current ?? 1;
          const limit = params.pageSize ?? 20;
          const keyword = typeof params.keyword === "string" ? params.keyword : undefined;
          const role = typeof params.role === "string" ? params.role : undefined;
          const status = typeof params.status === "string" ? params.status : undefined;
          const { data } = await api.get<{
            success: boolean;
            items: UserRow[];
            total: number;
          }>("/api/admin/users", {
            params: { page, limit, keyword, role, status },
          });
          return { data: data.items, total: data.total, success: true };
        }}
        search={{ labelWidth: "auto" }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />
    </PageContainer>
  );
}
