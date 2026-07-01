import {
  App as AntApp,
  Button,
  Input,
  Popconfirm,
  Tag,
} from "antd";
import { PageContainer, ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ActionType } from "@ant-design/pro-components";
import dayjs from "dayjs";
import axios from "axios";

import { api } from "../../lib/api";

type LicenseRequestRow = {
  id: string;
  durationDays: number;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  rejectReason: string | null;
  fulfilledLicenseId: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: {
    id: string;
    email: string;
    fullName: string;
  };
  reviewedBy: {
    id: string;
    email: string;
    fullName: string;
  } | null;
};

async function fetchLicenseRequests(params: {
  page: number;
  limit: number;
  keyword?: string;
  status?: string;
}) {
  const { data } = await api.get<{
    success: boolean;
    items: LicenseRequestRow[];
    total: number;
  }>("/api/admin/license-requests", { params });
  return data;
}

function statusColor(status: LicenseRequestRow["status"]) {
  if (status === "pending") return "orange";
  if (status === "approved") return "green";
  return "red";
}

export function AdminLicenseRequestsPage() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const actionRef = useRef<ActionType | null>(null);

  const approveMut = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/api/admin/license-requests/${id}/approve`, {}),
    onSuccess: () => {
      message.success(t("adminLicenseRequests.approved"));
      actionRef.current?.reload();
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      message.error(msg ?? "Request failed");
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.patch(`/api/admin/license-requests/${id}/reject`, { reason }),
    onSuccess: () => {
      message.success(t("adminLicenseRequests.rejected"));
      actionRef.current?.reload();
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      message.error(msg ?? "Request failed");
    },
  });

  const columns: ProColumns<LicenseRequestRow>[] = [
    {
      title: "#",
      width: 48,
      search: false,
      render: (_, __, i) => i + 1,
    },
    {
      title: t("adminLicenseRequests.email"),
      dataIndex: ["user", "email"],
      search: false,
      ellipsis: true,
    },
    {
      title: t("adminLicenseRequests.fullName"),
      dataIndex: ["user", "fullName"],
      search: false,
      ellipsis: true,
    },
    {
      title: t("adminLicenseRequests.search"),
      dataIndex: "keyword",
      hideInTable: true,
    },
    {
      title: t("adminLicenseRequests.note"),
      dataIndex: "note",
      search: false,
      ellipsis: true,
      render: (_, row) => row.note ?? "—",
    },
    {
      title: t("common.status"),
      dataIndex: "status",
      valueType: "select",
      valueEnum: {
        pending: { text: t("adminLicenseRequests.statusPending") },
        approved: { text: t("adminLicenseRequests.statusApproved") },
        rejected: { text: t("adminLicenseRequests.statusRejected") },
      },
      render: (_, row) => (
        <Tag color={statusColor(row.status)}>
          {row.status === "pending"
            ? t("adminLicenseRequests.statusPending")
            : row.status === "approved"
              ? t("adminLicenseRequests.statusApproved")
              : t("adminLicenseRequests.statusRejected")}
        </Tag>
      ),
    },
    {
      title: t("adminLicenseRequests.durationDays"),
      dataIndex: "durationDays",
      search: false,
      width: 100,
      render: (_, row) => `${row.durationDays} ${t("adminLicenseRequests.days")}`,
    },
    {
      title: t("adminLicenseRequests.createdAt"),
      dataIndex: "createdAt",
      search: false,
      render: (_, row) => dayjs(row.createdAt).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: t("adminLicenseRequests.reviewedAt"),
      dataIndex: "reviewedAt",
      search: false,
      render: (_, row) =>
        row.reviewedAt ? dayjs(row.reviewedAt).format("YYYY-MM-DD HH:mm") : "—",
    },
    {
      title: t("adminLicenses.actions"),
      valueType: "option",
      width: 180,
      search: false,
      render: (_, row) => {
        if (row.status !== "pending") {
          return row.rejectReason ? (
            <span className="text-sm text-slate-500">{row.rejectReason}</span>
          ) : null;
        }

        return [
          <Popconfirm
            key="approve"
            title={t("adminLicenseRequests.confirmApprove")}
            onConfirm={() => approveMut.mutate(row.id)}
          >
            <Button type="link" loading={approveMut.isPending}>
              {t("adminLicenseRequests.approve")}
            </Button>
          </Popconfirm>,
          <Popconfirm
            key="reject"
            title={t("adminLicenseRequests.confirmReject")}
            description={
              <Input.TextArea
                rows={2}
                placeholder={t("adminLicenseRequests.rejectReasonLabel")}
                id={`reject-reason-${row.id}`}
              />
            }
            onConfirm={() => {
              const el = document.getElementById(
                `reject-reason-${row.id}`,
              ) as HTMLTextAreaElement | null;
              rejectMut.mutate({
                id: row.id,
                reason: el?.value?.trim() || undefined,
              });
            }}
          >
            <Button type="link" danger loading={rejectMut.isPending}>
              {t("adminLicenseRequests.reject")}
            </Button>
          </Popconfirm>,
        ];
      },
    },
  ];

  return (
    <PageContainer title={t("menu.licenseRequests")}>
      <ProTable<LicenseRequestRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        cardBordered
        scroll={{ x: "max-content" }}
        request={async (params) => {
          const data = await fetchLicenseRequests({
            page: params.current ?? 1,
            limit: params.pageSize ?? 20,
            keyword:
              typeof params.keyword === "string" ? params.keyword : undefined,
            status:
              typeof params.status === "string" ? params.status : undefined,
          });
          return { data: data.items, total: data.total, success: true };
        }}
        search={{ labelWidth: "auto" }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />
    </PageContainer>
  );
}
