import {
  App as AntApp,
  Button,
  Form,
  Input,
  List,
  Pagination,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Space,
  Tabs,
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
import axios from "axios";

import { AdminExcelTransferButtons } from "../../components/admin/AdminExcelTransferButtons";
import { CreateUserModal } from "../../components/admin/CreateUserModal";
import { UserAdminMobileCard, type UserAdminRow } from "../../components/admin/UserAdminMobileCard";
import { useIsMobile } from "../../hooks/useIsMobile";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/useAuthStore";
import { userStatusColor, userStatusLabel } from "../../lib/statusLabels";

type UserRow = UserAdminRow;
type UserTab = "all" | "new";

type FetchParams = {
  page: number;
  limit: number;
  keyword?: string;
  role?: string;
  status?: string;
  registrationSource?: string;
  tab: UserTab;
};

async function fetchUsers(params: FetchParams) {
  const { data } = await api.get<{
    success: boolean;
    items: UserRow[];
    total: number;
  }>("/api/admin/users", {
    params: {
      page: params.page,
      limit: params.limit,
      keyword: params.keyword,
      role: params.role,
      status: params.status,
      registrationSource: params.registrationSource,
      ...(params.tab === "new" ? { welcomeEmailPending: true } : {}),
    },
  });
  return data;
}

function canSendWelcomeEmail(row: UserRow) {
  return row.registrationSource === "self" && !row.welcomeEmailSentAt;
}

function getSendEmailDisabledReason(
  row: UserRow,
  t: (key: string) => string,
): string | undefined {
  if (canSendWelcomeEmail(row)) return undefined;
  if (row.registrationSource !== "self") return t("adminUsers.sendEmailDisabledAdmin");
  if (row.welcomeEmailSentAt) return t("adminUsers.sendEmailDisabledSent");
  return undefined;
}

type MobileFilters = {
  keyword?: string;
  role?: string;
  status?: string;
  registrationSource?: string;
};

function AdminUsersMobileList({ tab }: { tab: UserTab }) {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<MobileFilters>({});
  const [form] = Form.useForm<MobileFilters>();
  const limit = 10;

  const listQuery = useQuery({
    queryKey: ["admin-users-mobile", tab, page, limit, filters],
    queryFn: () =>
      fetchUsers({
        page,
        limit,
        keyword: filters.keyword,
        role: filters.role,
        status: filters.status,
        registrationSource: filters.registrationSource,
        tab,
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

  const sendEmailMut = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/api/admin/users/${userId}/send-welcome-email`, {}),
    onSuccess: () => {
      message.success(t("adminUsers.emailSent"));
      invalidate();
    },
    onError: (err: Error) => {
      const apiMessage = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      message.error(apiMessage ?? err.message);
    },
  });

  const changeSourceMut = useMutation({
    mutationFn: ({
      userId,
      registrationSource,
    }: {
      userId: string;
      registrationSource: "self" | "admin";
    }) =>
      api.patch(`/api/admin/users/${userId}/registration-source`, {
        registrationSource,
      }),
    onSuccess: () => {
      message.success(t("adminUsers.sourceChanged"));
      invalidate();
    },
    onError: (err: Error) => {
      const apiMessage = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      message.error(apiMessage ?? err.message);
    },
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
        <Form.Item name="registrationSource" label={t("adminUsers.filterSource")}>
          <Select
            allowClear
            options={[
              { value: "self", label: t("adminUsers.sourceSelf") },
              { value: "admin", label: t("adminUsers.sourceAdmin") },
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
                sendEmailLoading={sendEmailMut.isPending}
                onBlock={() => blockMut.mutate(row.id)}
                onUnblock={() => unblockMut.mutate(row.id)}
                onResetDevice={() => resetDeviceMut.mutate(row.id)}
                onSendEmail={() => sendEmailMut.mutate(row.id)}
                onChangeSource={(registrationSource) =>
                  changeSourceMut.mutate({ userId: row.id, registrationSource })
                }
                changeSourceLoading={changeSourceMut.isPending}
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

function AdminUsersDesktopTable({ tab }: { tab: UserTab }) {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const currentUser = useAuthStore((s) => s.user);
  const actionRef = useRef<ActionType | null>(null);
  const [changeSourceRow, setChangeSourceRow] = useState<UserRow | null>(null);
  const [changeSourceForm] = Form.useForm<{ registrationSource: "self" | "admin" }>();

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

  const sendEmailMut = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/api/admin/users/${userId}/send-welcome-email`, {}),
    onSuccess: () => {
      message.success(t("adminUsers.emailSent"));
      actionRef.current?.reload();
    },
    onError: (err: Error) => {
      const apiMessage = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      message.error(apiMessage ?? err.message);
    },
  });

  const changeSourceMut = useMutation({
    mutationFn: ({
      userId,
      registrationSource,
    }: {
      userId: string;
      registrationSource: "self" | "admin";
    }) =>
      api.patch(`/api/admin/users/${userId}/registration-source`, {
        registrationSource,
      }),
    onSuccess: () => {
      message.success(t("adminUsers.sourceChanged"));
      setChangeSourceRow(null);
      actionRef.current?.reload();
    },
    onError: (err: Error) => {
      const apiMessage = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      message.error(apiMessage ?? err.message);
    },
  });

  const openChangeSource = (row: UserRow) => {
    setChangeSourceRow(row);
    changeSourceForm.setFieldsValue({
      registrationSource: row.registrationSource,
    });
  };

  const statusColor = userStatusColor;

  const columns: ProColumns<UserRow>[] = [
    {
      title: "#",
      width: 48,
      align: "center",
      search: false,
      render: (_, __, i) => i + 1,
    },
    {
      title: t("adminUsers.email"),
      dataIndex: "email",
      search: false,
      ellipsis: true,
      width: 240,
    },
    {
      title: t("adminUsers.fullName"),
      dataIndex: "fullName",
      search: false,
      ellipsis: true,
      width: 150,
    },
    {
      title: t("adminUsers.search"),
      dataIndex: "keyword",
      hideInTable: true,
    },
    {
      title: t("adminUsers.registrationSource"),
      dataIndex: "registrationSource",
      valueType: "select",
      hideInTable: true,
      valueEnum: {
        self: { text: t("adminUsers.sourceSelf") },
        admin: { text: t("adminUsers.sourceAdmin") },
      },
    },
    {
      title: t("adminUsers.registrationSource"),
      dataIndex: "registrationSource",
      search: false,
      width: 112,
      align: "center",
      render: (_, row) => {
        const label =
          row.registrationSource === "admin"
            ? t("adminUsers.sourceAdmin")
            : t("adminUsers.sourceSelf");
        return (
          <Tooltip title={t("adminUsers.clickToChangeSource")}>
            <Button
              type="link"
              size="small"
              className="h-auto px-0!"
              onClick={() => openChangeSource(row)}
            >
              {label}
            </Button>
          </Tooltip>
        );
      },
    },
    {
      title: t("adminUsers.createdBy"),
      dataIndex: "createdByAdmin",
      search: false,
      width: 130,
      ellipsis: true,
      render: (_, row) =>
        row.registrationSource === "admin" && row.createdByAdmin
          ? row.createdByAdmin.fullName
          : "—",
    },
    {
      title: t("adminUsers.emailStatus"),
      dataIndex: "welcomeEmailSentAt",
      search: false,
      width: 120,
      align: "center",
      render: (_, row) => {
        if (row.registrationSource !== "self") {
          return <Tag>{t("adminUsers.emailNotApplicable")}</Tag>;
        }
        if (row.welcomeEmailSentAt) {
          return (
            <Tooltip title={dayjs(row.welcomeEmailSentAt).format("YYYY-MM-DD HH:mm")}>
              <Tag color="green">{t("adminUsers.emailSentStatus")}</Tag>
            </Tooltip>
          );
        }
        return <Tag color="orange">{t("adminUsers.emailPending")}</Tag>;
      },
    },
    {
      title: t("adminUsers.role"),
      dataIndex: "role",
      width: 110,
      align: "center",
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
      width: 130,
      align: "center",
      valueType: "select",
      valueEnum: {
        active: { text: t("common.active") },
        blocked: { text: t("adminUsers.blockedStatus") },
      },
      render: (_, row) => (
        <Tag color={statusColor(row.status)}>
          {userStatusLabel(row.status, t)}
        </Tag>
      ),
    },
    {
      title: t("adminUsers.device"),
      dataIndex: "registeredDeviceId",
      search: false,
      width: 100,
      align: "center",
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
      width: 150,
      render: (_, row) => dayjs(row.createdAt).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: t("common.actions"),
      valueType: "option",
      search: false,
      fixed: "right",
      width: 260,
      render: (_, row) => {
        const isSelf = currentUser?.id === row.id;
        const sendEmailEnabled = canSendWelcomeEmail(row);
        const sendEmailDisabledReason = getSendEmailDisabledReason(row, t);
        const resetDeviceEnabled = !!row.registeredDeviceId;

        const sendEmailAction = sendEmailEnabled ? (
          <Popconfirm
            key="send-email"
            title={t("adminUsers.confirmSendEmail")}
            onConfirm={() => sendEmailMut.mutate(row.id)}
          >
            <Button type="link" size="small" loading={sendEmailMut.isPending}>
              {t("adminUsers.sendEmail")}
            </Button>
          </Popconfirm>
        ) : (
          <Tooltip key="send-email" title={sendEmailDisabledReason}>
            <span>
              <Button type="link" size="small" disabled>
                {t("adminUsers.sendEmail")}
              </Button>
            </span>
          </Tooltip>
        );

        const blockAction =
          row.status === "blocked" ? (
            <Popconfirm
              key="unblock"
              title={t("adminUsers.confirmUnblock")}
              onConfirm={() => unblockMut.mutate(row.id)}
            >
              <Button type="link" size="small" loading={unblockMut.isPending}>
                {t("adminUsers.unblock")}
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              key="block"
              title={isSelf ? t("adminUsers.cannotBlockSelf") : t("adminUsers.confirmBlock")}
              onConfirm={() => blockMut.mutate(row.id)}
              disabled={isSelf}
            >
              <Button type="link" size="small" danger disabled={isSelf} loading={blockMut.isPending}>
                {t("adminUsers.block")}
              </Button>
            </Popconfirm>
          );

        const resetDeviceAction = resetDeviceEnabled ? (
          <Popconfirm
            key="reset-device"
            title={t("adminUsers.confirmResetDevice")}
            onConfirm={() => resetDeviceMut.mutate(row.id)}
          >
            <Button type="link" size="small" loading={resetDeviceMut.isPending}>
              {t("adminUsers.resetDevice")}
            </Button>
          </Popconfirm>
        ) : (
          <Tooltip key="reset-device" title={t("adminUsers.resetDeviceDisabled")}>
            <span>
              <Button type="link" size="small" disabled>
                {t("adminUsers.resetDevice")}
              </Button>
            </span>
          </Tooltip>
        );

        return (
          <div className="flex flex-nowrap items-center">
            {sendEmailAction}
            {blockAction}
            {resetDeviceAction}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <ProTable<UserRow>
        key={tab}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        cardBordered
        scroll={{ x: 1400 }}
        className="admin-users-table"
        request={async (params) => {
          const data = await fetchUsers({
            page: params.current ?? 1,
            limit: params.pageSize ?? 20,
            keyword: typeof params.keyword === "string" ? params.keyword : undefined,
            role: typeof params.role === "string" ? params.role : undefined,
            status: typeof params.status === "string" ? params.status : undefined,
            registrationSource:
              typeof params.registrationSource === "string"
                ? params.registrationSource
                : undefined,
            tab,
          });
          return { data: data.items, total: data.total, success: true };
        }}
        search={{ labelWidth: "auto" }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />

      <Modal
        title={t("adminUsers.changeSource")}
        open={!!changeSourceRow}
        onCancel={() => setChangeSourceRow(null)}
        confirmLoading={changeSourceMut.isPending}
        onOk={() => changeSourceForm.submit()}
      >
        <Form
          form={changeSourceForm}
          layout="vertical"
          onFinish={(values) => {
            if (!changeSourceRow) return;
            changeSourceMut.mutate({
              userId: changeSourceRow.id,
              registrationSource: values.registrationSource,
            });
          }}
        >
          <Form.Item
            name="registrationSource"
            label={t("adminUsers.registrationSource")}
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "self", label: t("adminUsers.sourceSelf") },
                { value: "admin", label: t("adminUsers.sourceAdmin") },
              ]}
            />
          </Form.Item>
          {changeSourceRow ? (
            <p className="text-sm text-slate-500">
              {changeSourceRow.fullName} ({changeSourceRow.email})
            </p>
          ) : null}
        </Form>
      </Modal>
    </>
  );
}

export function AdminUsersPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<UserTab>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-users-mobile"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const tabItems = [
    {
      key: "all",
      label: t("adminUsers.tabAll"),
      children: isMobile ? (
        <AdminUsersMobileList tab="all" />
      ) : (
        <AdminUsersDesktopTable tab="all" />
      ),
    },
    {
      key: "new",
      label: t("adminUsers.tabNew"),
      children: isMobile ? (
        <AdminUsersMobileList tab="new" />
      ) : (
        <AdminUsersDesktopTable tab="new" />
      ),
    },
  ];

  return (
    <PageContainer
      title={t("menu.users")}
      extra={
        <Space wrap>
          <AdminExcelTransferButtons
            exportUrl="/api/admin/users/export"
            importUrl="/api/admin/users/import"
            templateUrl="/api/admin/users/export/template"
            onImported={reload}
          />
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            {t("adminUsers.createUser")}
          </Button>
        </Space>
      }
    >
      <Tabs activeKey={tab} items={tabItems} onChange={(k) => setTab(k as UserTab)} />
      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={reload}
      />
    </PageContainer>
  );
}
