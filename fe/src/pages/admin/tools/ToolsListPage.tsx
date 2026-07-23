import {
  App as AntApp,
  Button,
  Popconfirm,
} from "antd";
import { PageContainer, ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import {
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { ActionType } from "@ant-design/pro-components";
import dayjs from "dayjs";

import { api } from "../../../lib/api";
import type { AutomationTool, BrowserProfile } from "../../../types/automation";
import { countAllNodes } from "../../../types/automation";
import { RunToolModal } from "./RunToolModal";

type ToolRow = AutomationTool;

async function fetchTools(params: {
  page: number;
  limit: number;
  keyword?: string;
}) {
  const { data } = await api.get<{
    success: boolean;
    items: ToolRow[];
    total: number;
  }>("/api/admin/tools", { params });
  return data;
}

async function fetchProfiles() {
  const { data } = await api.get<{
    success: boolean;
    items: BrowserProfile[];
  }>("/api/admin/browser-profiles", { params: { limit: 100 } });
  return data.items;
}

export function ToolsListPage() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const actionRef = useRef<ActionType>(null);
  const [runTool, setRunTool] = useState<ToolRow | null>(null);

  const profilesQuery = useQuery({
    queryKey: ["browser-profiles-all"],
    queryFn: fetchProfiles,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/tools/${id}`),
    onSuccess: () => {
      message.success(t("automationTools.deleted"));
      void queryClient.invalidateQueries({ queryKey: ["automation-tools"] });
      actionRef.current?.reload();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const columns: ProColumns<ToolRow>[] = [
    {
      title: t("automationTools.name"),
      dataIndex: "name",
      ellipsis: true,
    },
    {
      title: t("common.description"),
      dataIndex: "description",
      ellipsis: true,
      search: false,
    },
    {
      title: t("automationTools.steps"),
      dataIndex: "steps",
      search: false,
      render: (_, row) =>
        Array.isArray(row.steps) ? countAllNodes(row.steps) : 0,
    },
    {
      title: t("automationTools.defaultLoop"),
      dataIndex: "defaultLoopCount",
      search: false,
      width: 100,
    },
    {
      title: t("automationTools.runs"),
      dataIndex: ["_count", "runs"],
      search: false,
      width: 80,
    },
    {
      title: t("automationTools.updatedAt"),
      dataIndex: "updatedAt",
      search: false,
      render: (_, row) => dayjs(row.updatedAt).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: t("automationTools.actions"),
      valueType: "option",
      width: 200,
      render: (_, row) => [
        <Button
          key="run"
          type="link"
          icon={<PlayCircleOutlined />}
          onClick={() => setRunTool(row)}
        >
          {t("automationTools.run")}
        </Button>,
        <Button
          key="edit"
          type="link"
          icon={<EditOutlined />}
          onClick={() => navigate(`/admin/tools/${row.id}/edit`)}
        >
          {t("automationTools.edit")}
        </Button>,
        <Popconfirm
          key="delete"
          title={t("automationTools.deleteConfirm")}
          onConfirm={() => deleteMut.mutate(row.id)}
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            {t("automationTools.delete")}
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer
      title={t("automationTools.title")}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate("/admin/tools/create")}
        >
          {t("automationTools.create")}
        </Button>
      }
    >
      <ProTable<ToolRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={{ labelWidth: "auto" }}
        request={async (params) => {
          const result = await fetchTools({
            page: params.current ?? 1,
            limit: params.pageSize ?? 20,
            keyword: params.name as string | undefined,
          });
          return {
            data: result.items,
            total: result.total,
            success: true,
          };
        }}
        pagination={{ defaultPageSize: 20 }}
      />

      <RunToolModal
        open={!!runTool}
        tool={runTool}
        profiles={profilesQuery.data ?? []}
        onClose={() => setRunTool(null)}
      />
    </PageContainer>
  );
}
