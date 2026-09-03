import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  FloatButton,
  Input,
  Space,
  Tag,
  Typography,
} from "antd";
import { CustomerServiceOutlined, SendOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useSupportSocket } from "../../hooks/useSupportSocket";
import { api } from "../../lib/api";
import type { SupportFaqItem, SupportMessage, SupportSession, SupportWsEvent } from "../../types/support";

function MessageBubble({ message }: { message: SupportMessage }) {
  const isUser = message.sender === "user";
  const isBot = message.sender === "bot";

  const align = isUser ? "justify-end" : "justify-start";
  const bg = isUser
    ? "bg-blue-600 text-white"
    : isBot
      ? "bg-slate-100 text-slate-800"
      : "bg-emerald-600 text-white";

  return (
    <div className={`flex ${align}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${bg}`}>
        {message.content}
      </div>
    </div>
  );
}

export function SupportChatWidget() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [session, setSession] = useState<SupportSession | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const joinedSessionRef = useRef<string | null>(null);

  const faqQuery = useQuery({
    queryKey: ["support-faq"],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; items: SupportFaqItem[] }>(
        "/api/support/faq",
      );
      return data.items;
    },
    enabled: open,
  });

  const activeSessionQuery = useQuery({
    queryKey: ["support-active-session"],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; session: SupportSession | null }>(
        "/api/support/sessions/active",
      );
      return data.session;
    },
    enabled: open,
  });

  useEffect(() => {
    if (activeSessionQuery.data) {
      setSession(activeSessionQuery.data);
      setMessages(activeSessionQuery.data.messages ?? []);
    }
  }, [activeSessionQuery.data]);

  const handleWsEvent = useCallback(
    (event: SupportWsEvent) => {
      if (event.type === "message:new") {
        setMessages((prev) => {
          if (prev.some((m) => m.id === event.message.id)) return prev;
          return [...prev, event.message];
        });
      }
      if (event.type === "session:deleted" && session?.id === event.sessionId) {
        setSession(null);
        setMessages([]);
        joinedSessionRef.current = null;
        void queryClient.invalidateQueries({ queryKey: ["support-active-session"] });
      }
    },
    [queryClient, session?.id],
  );

  const { connected, joinSession, leaveSession, sendMessage } = useSupportSocket({
    enabled: open,
    onEvent: handleWsEvent,
  });

  useEffect(() => {
    if (!open || !session?.id || !connected) return;
    if (joinedSessionRef.current === session.id) return;
    joinSession(session.id);
    joinedSessionRef.current = session.id;
    return () => {
      leaveSession(session.id);
      joinedSessionRef.current = null;
    };
  }, [connected, joinSession, leaveSession, open, session?.id]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const createSessionMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ success: boolean; session: SupportSession }>(
        "/api/support/sessions",
      );
      return data.session;
    },
    onSuccess: (newSession) => {
      setSession(newSession);
      setMessages(newSession.messages ?? []);
      void queryClient.invalidateQueries({ queryKey: ["support-active-session"] });
    },
  });

  const escalateMut = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await api.post<{ success: boolean; session: SupportSession }>(
        `/api/support/sessions/${sessionId}/escalate`,
      );
      return data.session;
    },
    onSuccess: (updated) => {
      setSession(updated);
    },
  });

  const faqMut = useMutation({
    mutationFn: async ({ sessionId, faqId }: { sessionId: string; faqId: string }) => {
      await api.post(`/api/support/sessions/${sessionId}/faq`, { faqId });
    },
  });

  const ensureSession = useCallback(async () => {
    if (session) return session;
    if (activeSessionQuery.data) return activeSessionQuery.data;
    return createSessionMut.mutateAsync();
  }, [activeSessionQuery.data, createSessionMut, session]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    try {
      const current = await ensureSession();
      const ok = sendMessage(current.id, text);
      if (!ok) {
        throw new Error("WebSocket not connected");
      }
      setDraft("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleFaqClick = async (faq: SupportFaqItem) => {
    try {
      const current = await ensureSession();
      await faqMut.mutateAsync({ sessionId: current.id, faqId: faq.id });
    } catch (err) {
      console.error(err);
    }
  };

  const statusTag = useMemo(() => {
    if (!session) return null;
    if (session.status === "waiting_admin") {
      return <Tag color="orange">{t("support.waitingAdmin")}</Tag>;
    }
    return <Tag color="blue">{t("support.autoReply")}</Tag>;
  }, [session, t]);

  const panel = (
    <Card
      className="w-[min(100vw-1.5rem,22rem)] shadow-xl"
      title={
        <Space>
          <CustomerServiceOutlined />
          <span>{t("support.title")}</span>
          {statusTag}
        </Space>
      }
      extra={
        <Button type="text" size="small" onClick={() => setOpen(false)}>
          ✕
        </Button>
      }
      styles={{ body: { padding: 12 } }}
    >
      <div ref={listRef} className="mb-3 flex max-h-64 min-h-40 flex-col gap-2 overflow-y-auto">
        {messages.length === 0 ? (
          <Typography.Text type="secondary">{t("support.emptyHint")}</Typography.Text>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
      </div>

      {(faqQuery.data?.length ?? 0) > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {faqQuery.data?.map((faq) => (
            <Button
              key={faq.id}
              size="small"
              disabled={faqMut.isPending}
              onClick={() => void handleFaqClick(faq)}
            >
              {faq.question}
            </Button>
          ))}
        </div>
      )}

      <Space.Compact className="w-full">
        <Input.TextArea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("support.inputPlaceholder")}
          autoSize={{ minRows: 1, maxRows: 3 }}
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
          loading={createSessionMut.isPending}
          onClick={() => void handleSend()}
        />
      </Space.Compact>

      {session?.status !== "waiting_admin" && (
        <Button
          block
          className="mt-2"
          loading={escalateMut.isPending}
          onClick={() => session && escalateMut.mutate(session.id)}
          disabled={!session}
        >
          {t("support.contactAdmin")}
        </Button>
      )}

      {!connected && (
        <Typography.Text type="secondary" className="mt-2 block text-xs">
          {t("support.reconnecting")}
        </Typography.Text>
      )}
    </Card>
  );

  return (
    <>
      {open && (
        <div className="fixed right-4 bottom-20 z-[1000] sm:bottom-24">
          {panel}
        </div>
      )}
      <FloatButton
        icon={<CustomerServiceOutlined />}
        type="primary"
        tooltip={t("support.title")}
        onClick={() => setOpen((v) => !v)}
        badge={{ dot: session?.status === "waiting_admin" }}
      />
    </>
  );
}
