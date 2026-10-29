import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { DownloadOutlined, ScanOutlined } from "@ant-design/icons";
import { PageContainer } from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../lib/api";
import { useZaloSocket } from "../../hooks/useZaloSocket";
import type {
  ZaloAccountRow,
  ZaloGroupMemberRow,
  ZaloGroupRow,
  ZaloScanSummary,
  ZaloWsEvent,
} from "../../types/zalo";

export function ZaloGroupScanPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState<string>();
  const [groupId, setGroupId] = useState<string>();
  const [search, setSearch] = useState("");
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);

  const accountsQuery = useQuery({
    queryKey: ["zalo", "accounts"],
    queryFn: async () => {
      const res = await api.get<{ data: ZaloAccountRow[] }>("/api/zalo/accounts");
      return res.data.data;
    },
  });

  const groupsQuery = useQuery({
    queryKey: ["zalo", "groups", accountId],
    enabled: Boolean(accountId),
    queryFn: async () => {
      const res = await api.get<{ data: ZaloGroupRow[] }>(`/api/zalo/accounts/${accountId}/groups`);
      return res.data.data;
    },
  });

  const scansQuery = useQuery({
    queryKey: ["zalo", "scans"],
    queryFn: async () => {
      const res = await api.get<{ data: ZaloScanSummary[] }>("/api/zalo/scans");
      return res.data.data;
    },
  });

  const scanDetailQuery = useQuery({
    queryKey: ["zalo", "scan", activeScanId],
    enabled: Boolean(activeScanId),
    refetchInterval: (q) =>
      q.state.data?.status === "running" ? 2000 : false,
    queryFn: async () => {
      const res = await api.get<{
        data: {
          id: string;
          status: string;
          progress: number;
          members: ZaloGroupMemberRow[];
          groupName: string | null;
        };
      }>(`/api/zalo/scans/${activeScanId}`);
      return res.data.data;
    },
  });

  useZaloSocket({
    onEvent: (event: ZaloWsEvent) => {
      if (event.type !== "zalo:scanProgress") return;
      if (activeScanId && event.scanId !== activeScanId) return;
      setScanProgress(event.progress);
      if (event.status === "completed" || event.status === "failed") {
        void queryClient.invalidateQueries({ queryKey: ["zalo", "scans"] });
        void queryClient.invalidateQueries({ queryKey: ["zalo", "scan", event.scanId] });
      }
    },
  });

  const startScan = useMutation({
    mutationFn: async () => {
      if (!accountId || !groupId) throw new Error("missing");
      const res = await api.post<{ data: { scanId: string } }>(
        `/api/zalo/accounts/${accountId}/groups/${groupId}/scan`,
      );
      return res.data.data.scanId;
    },
    onSuccess: (scanId) => {
      setActiveScanId(scanId);
      setScanProgress(0);
      void queryClient.invalidateQueries({ queryKey: ["zalo", "scans"] });
    },
  });

  const filteredMembers = useMemo(() => {
    const members = scanDetailQuery.data?.members ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.uid.toLowerCase().includes(q) ||
        (m.displayName ?? "").toLowerCase().includes(q) ||
        (m.zaloName ?? "").toLowerCase().includes(q),
    );
  }, [scanDetailQuery.data?.members, search]);

  const groupOptions = (groupsQuery.data ?? []).map((g) => ({
    value: g.groupId,
    label: `${g.name} (${g.memberCount})`,
  }));

  return (
    <PageContainer title={t("zalo.groupsTitle")} subTitle={t("zalo.groupsSubtitle")} className="zalo-page">
      <div className="mb-4 space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <Space wrap className="w-full">
          <Select
            placeholder={t("zalo.selectAccount")}
            style={{ minWidth: 220 }}
            value={accountId}
            options={(accountsQuery.data ?? []).map((a) => ({
              value: a.id,
              label: a.displayName,
            }))}
            onChange={(v) => {
              setAccountId(v);
              setGroupId(undefined);
            }}
          />
          <Select
            showSearch
            placeholder={t("zalo.selectGroup")}
            style={{ minWidth: 280 }}
            loading={groupsQuery.isLoading}
            disabled={!accountId}
            value={groupId}
            options={groupOptions}
            optionFilterProp="label"
            onChange={setGroupId}
          />
          <Button
            type="primary"
            icon={<ScanOutlined />}
            disabled={!accountId || !groupId}
            loading={startScan.isPending}
            onClick={() => startScan.mutate()}
          >
            {t("zalo.startScan")}
          </Button>
          {activeScanId && (
            <Button
              icon={<DownloadOutlined />}
              onClick={async () => {
                const res = await api.get(`/api/zalo/scans/${activeScanId}/export.xlsx`, {
                  responseType: "blob",
                });
                const url = URL.createObjectURL(res.data as Blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `zalo-group-${activeScanId.slice(0, 8)}.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Excel
            </Button>
          )}
        </Space>

        {activeScanId && (
          <div>
            <Typography.Text type="secondary">{t("zalo.scanProgress")}</Typography.Text>
            <Progress
              percent={scanDetailQuery.data?.progress ?? scanProgress}
              status={scanDetailQuery.data?.status === "failed" ? "exception" : "active"}
            />
          </div>
        )}
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <Typography.Title level={5}>{t("zalo.recentScans")}</Typography.Title>
        <Space wrap>
          {(scansQuery.data ?? []).slice(0, 8).map((s) => (
            <Tag
              key={s.id}
              color={s.id === activeScanId ? "blue" : undefined}
              className="cursor-pointer px-3 py-1"
              onClick={() => setActiveScanId(s.id)}
            >
              {s.groupName ?? s.groupId} · {s.memberCount} · {s.status}
            </Tag>
          ))}
        </Space>
      </div>

      {scanDetailQuery.data?.status === "failed" && (
        <Alert type="error" className="mb-4" message={t("zalo.scanFailed")} />
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
        <Input.Search
          placeholder={t("zalo.searchMembers")}
          allowClear
          className="mb-3 max-w-md"
          onChange={(e) => setSearch(e.target.value)}
        />
        <Table
          rowKey="id"
          size="middle"
          loading={scanDetailQuery.isLoading}
          dataSource={filteredMembers}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          columns={[
            { title: "UID", dataIndex: "uid", width: 160 },
            { title: t("zalo.colDisplayName"), dataIndex: "displayName" },
            { title: t("zalo.colZaloName"), dataIndex: "zaloName" },
          ]}
        />
      </div>
    </PageContainer>
  );
}
