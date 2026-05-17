import { Button, List, Pagination, Spin, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { PageContainer, ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";

import {
  LicenseAdminMobileCard,
  type LicenseAdminRow,
} from "../../components/admin/LicenseAdminMobileCard";
import { useIsMobile } from "../../hooks/useIsMobile";
import { api } from "../../lib/api";

type LicenseRow = LicenseAdminRow;

async function fetchLicenses(page: number, limit: number) {
  const { data } = await api.get<{
    success: boolean;
    items: LicenseRow[];
    total: number;
  }>("/api/admin/licenses", { params: { page, limit } });
  return data;
}

function AdminLicensesMobileList({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 10;

  const listQuery = useQuery({
    queryKey: ["admin-licenses-mobile", page, limit],
    queryFn: () => fetchLicenses(page, limit),
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <Button type="primary" icon={<PlusOutlined />} block onClick={onCreate}>
        {t("adminLicenses.create")}
      </Button>

      {listQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      ) : (
        <List
          dataSource={items}
          renderItem={(row) => (
            <List.Item className="!px-0">
              <LicenseAdminMobileCard
                row={row}
                onDetail={() => navigate(`/admin/licenses/${row.id}`)}
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

function AdminLicensesDesktopTable({ onCreate }: { onCreate: () => void }) {
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
        row.durationDays == null
          ? t("adminLicenses.lifetime")
          : row.durationDays,
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
    <ProTable<LicenseRow>
      rowKey="id"
      columns={columns}
      search={false}
      cardBordered
      scroll={{ x: "max-content" }}
      toolBarRender={() => [
        <Button key="create" type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          {t("adminLicenses.create")}
        </Button>,
      ]}
      request={async (params) => {
        const data = await fetchLicenses(params.current ?? 1, params.pageSize ?? 20);
        return {
          data: data.items,
          total: data.total,
          success: true,
        };
      }}
      pagination={{ pageSize: 20, showSizeChanger: true }}
    />
  );
}

export function AdminLicensesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const createBtn = (
    <Button
      key="create"
      type="primary"
      icon={<PlusOutlined />}
      onClick={() => navigate("/admin/licenses/create")}
      block={isMobile}
    >
      {t("adminLicenses.create")}
    </Button>
  );

  return (
    <PageContainer
      title={t("menu.licenses")}
      extra={isMobile ? undefined : [createBtn]}
    >
      {isMobile ? (
        <AdminLicensesMobileList
          onCreate={() => navigate("/admin/licenses/create")}
        />
      ) : (
        <AdminLicensesDesktopTable
          onCreate={() => navigate("/admin/licenses/create")}
        />
      )}
    </PageContainer>
  );
}
