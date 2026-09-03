import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  App as AntApp,
  Badge,
  Button,
  Empty,
  Input,
  Popconfirm,
  Tag,
} from "antd";
import { PageContainer } from "@ant-design/pro-components";
import { DeleteOutlined, SendOutlined, UserOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";

import {
  SupportConnectionBanner,
  SupportMessageList,
} from "../../components/support/SupportChatUi";
import { useSupportSocket } from "../../hooks/useSupportSocket";
import { api } from "../../lib/api";
import { sendSupportMessageRest } from "../../lib/supportApi";
import { appendSupportMessages } from "../../lib/supportMessages";
import type { SupportMessage, SupportSession, SupportWsEvent } from "../../types/support";

async function fetchSessions() {
  const { data } = await api.get<{ success: boolean; items: SupportSession[] }>(
    "/api/admin/support/sessions",
  );
  return data.items;
}

async function fetchSession(id: string) {
  const { data } = await api.get<{ success: boolean; session: SupportSession }>(
    `/api/admin/support/sessions/${id}`,
  );
  return data.session;
}

function SessionListItem({
  item,
  selected,
  onClick,
}: {
  item: SupportSession;
  selected: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const lastMsg = item.messages?.[0];
  const preview = lastMsg?.content ?? t("support.emptyHint");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
        selected
          ? "border-blue-200 bg-blue-50"
          : "border-transparent bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-sm font-semibold text-white">
        {(item.user?.fullName ?? "?").charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-slate-900">
            {item.user?.fullName ?? item.userId}
          </span>
          <span className="shrink-0 text-[10px] text-slate-400">
            {dayjs(item.updatedAt).format("HH:mm")}
          </span>
        </div>
        <div className="truncate text-xs text-slate-500">{item.user?.email}</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="truncate text-xs text-slate-600">{preview}</span>
          {item.status === "waiting_admin" ? (
            <Tag color="orange" className="!m-0 !text-[10px]">
              {t("support.waitingAdmin")}
            </Tag>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export function AdminSupportPage() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const joinedSessionRef = useRef<string | null>(null);
  const loadedSessionRef = useRef<string | null>(null);
  const sendingRef = useRef(false);

  const selectedId = params.id ?? null;

  const sessionsQuery = useQuery({
    queryKey: ["admin-support-sessions"],
    queryFn: fetchSessions,
    refetchInterval: 30_000,
  });

  const sessionQuery = useQuery({
    queryKey: ["admin-support-session", selectedId],
    queryFn: () => fetchSession(selectedId!),
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      loadedSessionRef.current = null;
      return;
    }
    if (sessionQuery.data?.id === selectedId && loadedSessionRef.current !== selectedId) {
      setMessages(sessionQuery.data.messages ?? []);
      loadedSessionRef.current = selectedId;
    }
  }, [selectedId, sessionQuery.data]);

  const appendMessages = useCallback((incoming: SupportMessage[]) => {
    setMessages((prev) => appendSupportMessages(prev, incoming));
  }, []);

  const handleWsEvent = useCallback(
    (event: SupportWsEvent) => {
      if (event.type === "session:escalated") {
        void queryClient.invalidateQueries({ queryKey: ["admin-support-sessions"] });
      }
      if (event.type === "session:deleted") {
        void queryClient.invalidateQueries({ queryKey: ["admin-support-sessions"] });
        if (selectedId === event.sessionId) {
          navigate("/admin/support", { replace: true });
        }
      }
      if (event.type === "message:new") {
        void queryClient.invalidateQueries({ queryKey: ["admin-support-sessions"] });
        if (event.sessionId === selectedId) {
          appendMessages([event.message]);
        }
      }
    },
    [appendMessages, navigate, queryClient, selectedId],
  );

  const { connected, connecting, joinSession, leaveSession, sendMessage } = useSupportSocket({
    enabled: true,
    onEvent: handleWsEvent,
  });

  useEffect(() => {
    if (!selectedId || !connected) return;
    if (joinedSessionRef.current === selectedId) return;
    joinSession(selectedId);
    joinedSessionRef.current = selectedId;
    return () => {
      leaveSession(selectedId);
      joinedSessionRef.current = null;
    };
  }, [connected, joinSession, leaveSession, selectedId]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/support/sessions/${id}`),
    onSuccess: () => {
      message.success(t("adminSupport.deleted"));
      void queryClient.invalidateQueries({ queryKey: ["admin-support-sessions"] });
      navigate("/admin/support", { replace: true });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      message.error(msg ?? t("adminSupport.deleteFailed"));
    },
  });

  const waitingCount = useMemo(
    () => (sessionsQuery.data ?? []).filter((s) => s.status === "waiting_admin").length,
    [sessionsQuery.data],
  );

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = sessionsQuery.data ?? [];
    if (!q) return items;
    return items.filter(
      (s) =>
        s.user?.fullName.toLowerCase().includes(q) ||
        s.user?.email.toLowerCase().includes(q),
    );
  }, [search, sessionsQuery.data]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !selectedId || sendingRef.current) return;

    sendingRef.current = true;
    try {
      const viaWs = sendMessage(selectedId, text);
      if (!viaWs) {
        const created = await sendSupportMessageRest(selectedId, text, "admin");
        appendMessages(created);
      }
      setDraft("");
    } catch {
      message.warning(t("support.sendFailed"));
    } finally {
      sendingRef.current = false;
    }
  };

  const selectedSession = sessionQuery.data;

  return (
    <PageContainer title={t("adminSupport.title")} subTitle={t("adminSupport.subtitle")}>
      <div className="grid h-[calc(100vh-12rem)] min-h-[520px] gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[340px_1fr]">
        {/* Session list */}
        <div className="flex flex-col border-r border-slate-200 bg-slate-50">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold text-slate-900">{t("adminSupport.sessions")}</span>
              <Badge count={waitingCount} />
            </div>
            <Input
              allowClear
              placeholder={t("adminSupport.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="!rounded-lg"
            />
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {sessionsQuery.isLoading ? (
              <div className="p-4 text-center text-sm text-slate-400">{t("common.loading")}</div>
            ) : filteredSessions.length === 0 ? (
              <Empty description={t("adminSupport.noSessions")} className="mt-8" />
            ) : (
              filteredSessions.map((item) => (
                <SessionListItem
                  key={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  onClick={() => navigate(`/admin/support/${item.id}`)}
                />
              ))
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className="flex min-w-0 flex-col">
          {!selectedId ? (
            <div className="flex flex-1 flex-col items-center justify-center text-slate-400">
              <UserOutlined className="mb-3 text-4xl" />
              <p>{t("adminSupport.selectSession")}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <div className="font-semibold text-slate-900">
                    {selectedSession?.user?.fullName ?? "…"}
                  </div>
                  <div className="text-xs text-slate-500">{selectedSession?.user?.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  {connected ? (
                    <Tag color="green">{t("support.connected")}</Tag>
                  ) : (
                    <Tag color="orange">{t("support.reconnecting")}</Tag>
                  )}
                  {selectedSession ? (
                    <Popconfirm
                      title={t("adminSupport.deleteConfirm")}
                      onConfirm={() => deleteMut.mutate(selectedSession.id)}
                    >
                      <Button
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        loading={deleteMut.isPending}
                      >
                        {t("adminSupport.deleteSession")}
                      </Button>
                    </Popconfirm>
                  ) : null}
                </div>
              </div>

              <SupportConnectionBanner connected={connected} connecting={connecting} />

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F9FAFB]">
                {sessionQuery.isLoading ? (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    {t("common.loading")}
                  </div>
                ) : (
                  <SupportMessageList
                    messages={messages}
                    perspective="admin"
                    emptyText={t("support.emptyHint")}
                    listRef={listRef}
                  />
                )}
              </div>

              <div className="border-t border-slate-200 bg-white p-4">
                <div className="flex items-end gap-2">
                  <Input.TextArea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t("support.inputPlaceholder")}
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    className="!rounded-xl"
                    onPressEnter={(e) => {
                      if (!e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    size="large"
                    className="!bg-[#2563EB]"
                    onClick={() => void handleSend()}
                  >
                    {t("support.send")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
