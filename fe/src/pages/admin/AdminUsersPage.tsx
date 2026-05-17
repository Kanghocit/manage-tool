import {
  App as AntApp,
  Button,
  Form,
  Input,
  List,
  Pagination,
  Popconfirm,
  Select,
  Spin,
  Tag,
  Tooltip,
} from "antd";
import { PageContainer, ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ActionType } from "@ant-design/pro-components";
import dayjs from "dayjs";

import { UserAdminMobileCard, type UserAdminRow } from "../../components/admin/UserAdminMobileCard";
import { useIsMobile } from "../../hooks/useIsMobile";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/useAuthStore";

type UserRow = UserAdminRow;

type MobileFilters = {
  keyword?: string;
  role?: string;
  status?: string;
};

async function fetchUsers(params: {
  page: number;
  limit: number;
  keyword?: string;
  role?: string;
  status?: string;
}) {
  const { data } = await api.get<{
    success: boolean;
    items: UserRow[];
    total: number;
  }>("/api/admin/users", { params });
  return data;
}

function AdminUsersMobileList() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<MobileFilters>({});
  const [form] = Form.useForm<MobileFilters>();
  const limit = 10;

  const listQuery = useQuery({
    queryKey: ["admin-users-mobile", page, limit, filters],
    queryFn: () =>
      fetchUsers({
        page,
        limit,
        keyword: filters.keyword,
        role: filters.role,
        status: filters.status,
      }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-users-mobile"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const blockMut = useMutation({
    mutationFn: (userId: string) => api.patch(`/api/admin/users/${userId}/block`, {}),
    onSuccess: () => {
      message.success(t("adminUsers.blocked"));
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const unblockMut = useMutation({
    mutationFn: (userId: string) => api.patch(`/api/admin/users/${userId}/unblock`, {}),
    onSuccess: () => {
      message.success(t("adminUsers.unblocked"));
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const resetDeviceMut = useMutation({
    mutationFn: (userId: string) =>
      api.patch(`/api/admin/users/${userId}/reset-device`, {}),
    onSuccess: () => {
      message.success(t("adminUsers.deviceReset"));
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const onSearch = (values: MobileFilters) => {
    setFilters(values);
    setPage(1);
  };

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <Form
        form={form}
        layout="vertical"
        onFinish={onSearch}
        className="rounded-xl bg-white p-3 shadow-sm"
      >
        <Form.Item name="keyword" label={t("adminUsers.search")}>
          <Input allowClear placeholder={t("adminUsers.search")} />
        </Form.Item>
        <Form.Item name="role" label={t("adminUsers.role")}>
          <Select
            allowClear
            options={[
              { value: "admin", label: t("roles.admin") },
              { value: "user", label: t("roles.user") },
            ]}
          />
        </Form.Item>
        <Form.Item name="status" label={t("common.status")}>
          <Select
            allowClear
            options={[
              { value: "active", label: t("common.active") },
              { value: "blocked", label: t("adminUsers.blockedStatus") },
            ]}
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" block>
          {t("adminUsers.search")}
        </Button>
      </Form>

      {listQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      ) : (
        <List
          dataSource={items}
          renderItem={(row) => (
            <List.Item className="!px-0">
              <UserAdminMobileCard
                row={row}
                isSelf={currentUser?.id === row.id}
                blockLoading={blockMut.isPending}
                unblockLoading={unblockMut.isPending}
                resetDeviceLoading={resetDeviceMut.isPending}
                onBlock={() => blockMut.mutate(row.id)}
                onUnblock={() => unblockMut.mutate(row.id)}
                onResetDevice={() => resetDeviceMut.mutate(row.id)}
              />
            </List.Item>
          )}
        />
      )}

      {total > limit ? (
        <Pagination
          current={page}
          pageSize={limit}
          total={total}
          onChange={setPage}
          size="small"
          simple
          className="flex justify-center"
        />
      ) : null}
    </div>
  );
}

function AdminUsersDesktopTable() {
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
    <ProTable<UserRow>
      actionRef={actionRef}
      rowKey="id"
      columns={columns}
      cardBordered
      scroll={{ x: "max-content" }}
      request={async (params) => {
        const data = await fetchUsers({
          page: params.current ?? 1,
          limit: params.pageSize ?? 20,
          keyword: typeof params.keyword === "string" ? params.keyword : undefined,
          role: typeof params.role === "string" ? params.role : undefined,
          status: typeof params.status === "string" ? params.status : undefined,
        });
        return { data: data.items, total: data.total, success: true };
      }}
      search={{ labelWidth: "auto" }}
      pagination={{ pageSize: 20, showSizeChanger: true }}
    />
  );
}

export function AdminUsersPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  return (
    <PageContainer title={t("menu.users")}>
      {isMobile ? <AdminUsersMobileList /> : <AdminUsersDesktopTable />}
    </PageContainer>
  );
}
