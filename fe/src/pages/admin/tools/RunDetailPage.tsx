import {
  App as AntApp,
  Button,
  Card,
  Collapse,
  Descriptions,
  Space,
  Tag,
  Typography,
} from "antd";
import { PageContainer } from "@ant-design/pro-components";
import { StopOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";

import { api } from "../../../lib/api";
import type { AutomationRun, RunStatus } from "../../../types/automation";

const ACTIVE_STATUSES: RunStatus[] = ["pending", "running"];

function statusColor(status: RunStatus): string {
  switch (status) {
    case "completed":
      return "success";
    case "running":
      return "processing";
    case "pending":
      return "default";
    case "cancelled":
      return "warning";
    case "failed":
      return "error";
    default:
      return "default";
  }
}

async function fetchRun(id: string) {
  const { data } = await api.get<{ success: boolean; run: AutomationRun }>(
    `/api/admin/runs/${id}`,
  );
  return data.run;
}

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const runQuery = useQuery({
    queryKey: ["automation-run", id],
    enabled: Boolean(id),
    queryFn: () => fetchRun(id!),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ACTIVE_STATUSES.includes(status) ? 2000 : false;
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => api.post(`/api/admin/runs/${id}/cancel`, {}),
    onSuccess: () => {
      message.success(t("automationRuns.cancelled"));
      void queryClient.invalidateQueries({ queryKey: ["automation-run", id] });
    },
    onError: (e: Error) => message.error(e.message),
  });

  const run = runQuery.data;
  const isActive = run && ACTIVE_STATUSES.includes(run.status);

  return (
    <PageContainer
      title={t("automationRuns.detailTitle")}
      loading={runQuery.isLoading}
      onBack={() => navigate("/admin/tools")}
      extra={
        isActive ? (
          <Button
            danger
            icon={<StopOutlined />}
            loading={cancelMut.isPending}
            onClick={() => cancelMut.mutate()}
          >
            {t("automationRuns.cancel")}
          </Button>
        ) : null
      }
    >
      {run ? (
        <>
          <Card className="mb-4">
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }}>
              <Descriptions.Item label={t("automationTools.name")}>
                {run.tool?.name ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label={t("common.status")}>
                <Tag color={statusColor(run.status)}>
                  {t(`automationRuns.status.${run.status}`)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t("automationTools.loopCount")}>
                {run.loopCount}
              </Descriptions.Item>
              <Descriptions.Item label={t("automationRuns.startedAt")}>
                {run.startedAt
                  ? dayjs(run.startedAt).format("DD/MM/YYYY HH:mm:ss")
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label={t("automationRuns.finishedAt")}>
                {run.finishedAt
                  ? dayjs(run.finishedAt).format("DD/MM/YYYY HH:mm:ss")
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label={t("automationRuns.sessions")}>
                {run.sessions?.length ?? 0}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Typography.Title level={5}>
            {t("automationRuns.sessionLogs")}
          </Typography.Title>

          <Collapse
            accordion
            defaultActiveKey={run.sessions?.[0]?.id}
            items={(run.sessions ?? []).map((session) => ({
              key: session.id,
              label: (
                <Space>
                  <span>{session.profile.name}</span>
                  <Tag color={statusColor(session.status)}>
                    {t(`automationRuns.status.${session.status}`)}
                  </Tag>
                  <span className="text-slate-500 text-sm">
                    {t("automationRuns.loopProgress", {
                      current: session.currentLoop,
                      total: run.loopCount,
                    })}
                  </span>
                </Space>
              ),
              children: (
                <div>
                  {session.error ? (
                    <Typography.Paragraph type="danger" className="mb-2">
                      {session.error}
                    </Typography.Paragraph>
                  ) : null}
                  <pre className="max-h-96 overflow-auto rounded bg-slate-950 p-3 text-xs text-green-300 whitespace-pre-wrap">
                    {session.log || t("automationRuns.noLog")}
                  </pre>
                </div>
              ),
            }))}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
