import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  App as AntApp,
  Button,
  FloatButton,
  Input,
  Tag,
} from "antd";
import {
  CloseOutlined,
  CustomerServiceOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import {
  SupportConnectionBanner,
  SupportMessageList,
} from "./SupportChatUi";
import { useSupportSocket } from "../../hooks/useSupportSocket";
import { api } from "../../lib/api";
import { sendSupportMessageRest } from "../../lib/supportApi";
import type { SupportFaqItem, SupportMessage, SupportSession, SupportWsEvent } from "../../types/support";

export function SupportChatWidget() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [session, setSession] = useState<SupportSession | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const joinedSessionRef = useRef<string | null>(null);

  const appendMessages = useCallback((incoming: SupportMessage[]) => {
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const added = incoming.filter((m) => !ids.has(m.id));
      if (added.length === 0) return prev;
      return [...prev, ...added];
    });
  }, []);

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
        appendMessages([event.message]);
      }
      if (event.type === "session:deleted" && session?.id === event.sessionId) {
        setSession(null);
        setMessages([]);
        joinedSessionRef.current = null;
        void queryClient.invalidateQueries({ queryKey: ["support-active-session"] });
      }
    },
    [appendMessages, queryClient, session?.id],
  );

  const { connected, connecting, joinSession, leaveSession, sendMessage } = useSupportSocket({
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
      message.success(t("support.escalated"));
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

  const dispatchMessage = async (sessionId: string, text: string) => {
    const viaWs = sendMessage(sessionId, text);
    if (viaWs) return;

    const created = await sendSupportMessageRest(sessionId, text, "user");
    appendMessages(created);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    try {
      const current = await ensureSession();
      await dispatchMessage(current.id, text);
      setDraft("");
    } catch {
      message.error(t("support.sendFailed"));
    }
  };

  const handleFaqClick = async (faq: SupportFaqItem) => {
    try {
      const current = await ensureSession();
      await faqMut.mutateAsync({ sessionId: current.id, faqId: faq.id });
    } catch {
      message.error(t("support.sendFailed"));
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
    <div className="flex h-[min(80vh,560px)] w-[min(100vw-1rem,380px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-[#2563EB] px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <CustomerServiceOutlined className="text-lg" />
          <div>
            <div className="font-semibold leading-tight">{t("support.title")}</div>
            <div className="text-xs text-blue-100">{t("support.subtitle")}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {statusTag}
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined className="!text-white" />}
            onClick={() => setOpen(false)}
          />
        </div>
      </div>

      <SupportConnectionBanner connected={connected} connecting={connecting} />

      {(faqQuery.data?.length ?? 0) > 0 && (
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-slate-100 bg-slate-50 px-3 py-2">
          {faqQuery.data?.map((faq) => (
            <button
              key={faq.id}
              type="button"
              disabled={faqMut.isPending}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
              onClick={() => void handleFaqClick(faq)}
            >
              {faq.question}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 bg-[#F9FAFB]">
        <SupportMessageList
          messages={messages}
          perspective="user"
          emptyText={t("support.emptyHint")}
          listRef={listRef}
        />
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
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
            shape="circle"
            size="large"
            icon={<SendOutlined />}
            loading={createSessionMut.isPending}
            className="!bg-[#2563EB]"
            onClick={() => void handleSend()}
          />
        </div>
        {session?.status !== "waiting_admin" && (
          <Button
            block
            type="link"
            className="mt-1 !text-[#2563EB]"
            loading={escalateMut.isPending}
            onClick={() => session && escalateMut.mutate(session.id)}
            disabled={!session}
          >
            {t("support.contactAdmin")}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {open && (
        <div className="fixed right-4 bottom-20 z-[1000] sm:bottom-6">
          {panel}
        </div>
      )}
      <FloatButton
        icon={<CustomerServiceOutlined />}
        type="primary"
        className="!bg-[#2563EB]"
        tooltip={t("support.title")}
        onClick={() => setOpen((v) => !v)}
        badge={{ dot: session?.status === "waiting_admin" }}
      />
    </>
  );
}
