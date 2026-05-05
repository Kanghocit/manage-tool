import { Button, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { PageContainer, ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";

import { api } from "../../lib/api";

type LicenseRow = {
  id: string;
  licenseKey: string | null;
  licenseKeyPreview: string;
  status: string;
  durationDays: number | null;
  expiresAt: string | null;
  maxDevices: number;
  activatedBy: string | null;
  activatedAt: string | null;
};

export function AdminLicensesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const statusColor = (s: string) => {
    if (s === "active") return "green";
    if (s === "blocked") return "red";
    if (s === "expired") return "default";
    return "blue";
  };

  const columns: ProColumns<LicenseRow>[] = [
    {
      title: "#",
      width: 48,
      render: (_, __, i) => i + 1,
    },
    {
      title: t("adminLicenses.fullKey"),
      dataIndex: "licenseKey",
      copyable: true,
      ellipsis: true,
      render: (_, row) =>
        row.licenseKey ?? (
          <span className="text-slate-400">
            {row.licenseKeyPreview} ({t("adminLicenses.legacyNoPlain")})
          </span>
        ),
    },
    {
      title: t("common.status"),
      dataIndex: "status",
      render: (_, row) => (
        <Tag color={statusColor(row.status)}>{row.status}</Tag>
      ),
    },
    {
      title: t("pages.maxDevices"),
      dataIndex: "maxDevices",
      width: 100,
    },
    {
      title: t("adminLicenses.durationDays"),
      dataIndex: "durationDays",
      width: 120,
      render: (_, row) =>
        row.durationDays == null ? t("adminLicenses.lifetime") : row.durationDays,
    },
    {
      title: t("pages.expiresAt"),
      dataIndex: "expiresAt",
      render: (_, row) =>
        row.expiresAt ? dayjs(row.expiresAt).format("YYYY-MM-DD HH:mm") : "-",
    },
    {
      title: t("adminLicenses.activatedBy"),
      dataIndex: "activatedBy",
      ellipsis: true,
    },
    {
      title: t("adminLicenses.activatedAt"),
      dataIndex: "activatedAt",
      render: (_, row) =>
        row.activatedAt
          ? dayjs(row.activatedAt).format("YYYY-MM-DD HH:mm")
          : "-",
    },
    {
      title: t("adminLicenses.actions"),
      valueType: "option",
      width: 120,
      render: (_, row) => [
        <Button
          key="view"
          type="link"
          onClick={() => navigate(`/admin/licenses/${row.id}`)}
        >
          {t("adminLicenses.detail")}
        </Button>,
      ],
    },
  ];

  return (
    <PageContainer
      title={t("menu.licenses")}
      extra={[
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate("/admin/licenses/create")}
        >
          {t("adminLicenses.create")}
        </Button>,
      ]}
    >
      <ProTable<LicenseRow>
        rowKey="id"
        columns={columns}
        search={false}
        cardBordered
        request={async (params) => {
          const page = params.current ?? 1;
          const limit = params.pageSize ?? 20;
          const { data } = await api.get<{
            success: boolean;
            items: LicenseRow[];
            total: number;
          }>("/api/admin/licenses", {
            params: { page, limit },
          });
          return {
            data: data.items,
            total: data.total,
            success: true,
          };
        }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />
    </PageContainer>
  );
}
