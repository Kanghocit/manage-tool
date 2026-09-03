import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  App as AntApp,
  Badge,
  Button,
  Card,
  Empty,
  Input,
  List,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from "antd";
import { PageContainer } from "@ant-design/pro-components";
import { DeleteOutlined, SendOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";

import { useSupportSocket } from "../../hooks/useSupportSocket";
import { api } from "../../lib/api";
import type { SupportMessage, SupportSession, SupportWsEvent } from "../../types/support";

function MessageBubble({ message }: { message: SupportMessage }) {
  const isAdmin = message.sender === "admin";
  const isUser = message.sender === "user";
  const align = isAdmin ? "justify-end" : "justify-start";
  const bg = isAdmin
    ? "bg-emerald-600 text-white"
    : isUser
      ? "bg-blue-50 text-slate-900"
      : "bg-slate-100 text-slate-800";

  return (
    <div className={`flex ${align}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${bg}`}>
        {message.content}
      </div>
    </div>
  );
}

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

export function AdminSupportPage() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const joinedSessionRef = useRef<string | null>(null);

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
    if (sessionQuery.data) {
      setMessages(sessionQuery.data.messages ?? []);
    } else {
      setMessages([]);
    }
  }, [sessionQuery.data]);

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
      if (event.type === "message:new" && event.sessionId === selectedId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === event.message.id)) return prev;
          return [...prev, event.message];
        });
      }
    },
    [navigate, queryClient, selectedId],
  );

  const { connected, joinSession, leaveSession, sendMessage } = useSupportSocket({
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

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, selectedId]);

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

  const handleSend = () => {
    const text = draft.trim();
    if (!text || !selectedId) return;
    const ok = sendMessage(selectedId, text);
    if (!ok) {
      message.warning(t("support.reconnecting"));
      return;
    }
    setDraft("");
  };

  const selectedSession = sessionQuery.data;

  return (
    <PageContainer title={t("adminSupport.title")} subTitle={t("adminSupport.subtitle")}>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card
          title={
            <Space>
              {t("adminSupport.sessions")}
              <Badge count={waitingCount} />
            </Space>
          }
          loading={sessionsQuery.isLoading}
        >
          <List
            dataSource={sessionsQuery.data ?? []}
            locale={{ emptyText: t("adminSupport.noSessions") }}
            renderItem={(item) => (
              <List.Item
                className={`cursor-pointer rounded-lg px-2 ${selectedId === item.id ? "bg-blue-50" : ""}`}
                onClick={() => navigate(`/admin/support/${item.id}`)}
              >
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <span>{item.user?.fullName ?? item.userId}</span>
                      <Tag color={item.status === "waiting_admin" ? "orange" : "blue"}>
                        {item.status === "waiting_admin"
                          ? t("support.waitingAdmin")
                          : t("support.autoReply")}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Typography.Text type="secondary" className="text-xs">
                      {item.user?.email} · {dayjs(item.updatedAt).format("DD/MM HH:mm")}
                    </Typography.Text>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        <Card
          title={
            selectedSession
              ? `${selectedSession.user?.fullName ?? ""} (${selectedSession.user?.email ?? ""})`
              : t("adminSupport.selectSession")
          }
          extra={
            selectedSession ? (
              <Popconfirm
                title={t("adminSupport.deleteConfirm")}
                onConfirm={() => deleteMut.mutate(selectedSession.id)}
              >
                <Button danger icon={<DeleteOutlined />} loading={deleteMut.isPending}>
                  {t("adminSupport.deleteSession")}
                </Button>
              </Popconfirm>
            ) : null
          }
          loading={Boolean(selectedId) && sessionQuery.isLoading}
        >
          {!selectedId ? (
            <Empty description={t("adminSupport.selectSession")} />
          ) : (
            <>
              <div
                ref={listRef}
                className="mb-4 flex max-h-[420px] min-h-[280px] flex-col gap-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3"
              >
                {messages.length === 0 ? (
                  <Typography.Text type="secondary">{t("support.emptyHint")}</Typography.Text>
                ) : (
                  messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
                )}
              </div>

              <Space.Compact className="w-full">
                <Input.TextArea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t("support.inputPlaceholder")}
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button type="primary" icon={<SendOutlined />} onClick={handleSend}>
                  {t("support.send")}
                </Button>
              </Space.Compact>

              {!connected && (
                <Typography.Text type="secondary" className="mt-2 block text-xs">
                  {t("support.reconnecting")}
                </Typography.Text>
              )}
            </>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
