import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  App as AntApp,
  Button,
  Input,
  Tag,
} from "antd";
import { CustomerServiceOutlined, SendOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import {
  SupportConnectionBanner,
  SupportMessageList,
} from "./SupportChatUi";
import { useSupportSocket } from "../../hooks/useSupportSocket";
import { api } from "../../lib/api";
import { sendSupportMessageRest } from "../../lib/supportApi";
import { appendSupportMessages } from "../../lib/supportMessages";
import { acquireSendLock, releaseSendLock, shouldSendOnEnterKey } from "../../lib/supportSendGuard";
import type { SupportFaqItem, SupportMessage, SupportSession, SupportWsEvent } from "../../types/support";

type SupportChatPanelProps = {
  className?: string;
};

export function SupportChatPanel({ className }: SupportChatPanelProps) {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [session, setSession] = useState<SupportSession | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const joinedSessionRef = useRef<string | null>(null);
  const creatingSessionRef = useRef<Promise<SupportSession> | null>(null);
  const loadedSessionRef = useRef<string | null>(null);
  const sendingRef = useRef(false);
  const faqBusyRef = useRef(false);
  const lastSentRef = useRef<{ text: string; at: number } | null>(null);

  const appendMessages = useCallback((incoming: SupportMessage[]) => {
    setMessages((prev) => appendSupportMessages(prev, incoming));
  }, []);

  const faqQuery = useQuery({
    queryKey: ["support-faq"],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; items: SupportFaqItem[] }>(
        "/api/support/faq",
      );
      return data.items;
    },
  });

  const activeSessionQuery = useQuery({
    queryKey: ["support-active-session"],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; session: SupportSession | null }>(
        "/api/support/sessions/active",
      );
      return data.session;
    },
  });

  useEffect(() => {
    const data = activeSessionQuery.data;
    if (!data) return;
    setSession(data);
    if (loadedSessionRef.current !== data.id) {
      loadedSessionRef.current = data.id;
      setMessages(data.messages ?? []);
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
    enabled: true,
    onEvent: handleWsEvent,
  });

  useEffect(() => {
    if (!session?.id || !connected) return;
    if (joinedSessionRef.current === session.id) return;
    joinSession(session.id);
    joinedSessionRef.current = session.id;
    return () => {
      leaveSession(session.id);
      joinedSessionRef.current = null;
    };
  }, [connected, joinSession, leaveSession, session?.id]);

  const createSessionMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ success: boolean; session: SupportSession }>(
        "/api/support/sessions",
      );
      return data.session;
    },
    onSuccess: (newSession) => {
      setSession(newSession);
      loadedSessionRef.current = newSession.id;
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

  const ensureSession = useCallback(async (): Promise<SupportSession> => {
    if (session) return session;

    if (activeSessionQuery.isLoading || activeSessionQuery.isFetching) {
      const result = await activeSessionQuery.refetch();
      if (result.data) {
        setSession(result.data);
        setMessages(result.data.messages ?? []);
        return result.data;
      }
    } else if (activeSessionQuery.data) {
      setSession(activeSessionQuery.data);
      setMessages(activeSessionQuery.data.messages ?? []);
      return activeSessionQuery.data;
    }

    if (creatingSessionRef.current) {
      return creatingSessionRef.current;
    }

    creatingSessionRef.current = createSessionMut
      .mutateAsync()
      .finally(() => {
        creatingSessionRef.current = null;
      });

    return creatingSessionRef.current;
  }, [
    activeSessionQuery.data,
    activeSessionQuery.isFetching,
    activeSessionQuery.isLoading,
    activeSessionQuery,
    createSessionMut,
    session,
  ]);

  const dispatchMessage = async (sessionId: string, text: string) => {
    const viaWs = sendMessage(sessionId, text);
    if (viaWs) return;

    const created = await sendSupportMessageRest(sessionId, text, "user");
    appendMessages(created);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    if (!acquireSendLock(sendingRef, lastSentRef, text)) return;

    setDraft("");

    try {
      const current = await ensureSession();
      await dispatchMessage(current.id, text);
    } catch {
      message.error(t("support.sendFailed"));
    } finally {
      releaseSendLock(sendingRef);
    }
  };

  const handleFaqClick = async (faq: SupportFaqItem) => {
    if (faqBusyRef.current || faqMut.isPending) return;
    faqBusyRef.current = true;
    try {
      const current = await ensureSession();
      await faqMut.mutateAsync({ sessionId: current.id, faqId: faq.id });
    } catch {
      message.error(t("support.sendFailed"));
    } finally {
      faqBusyRef.current = false;
    }
  };

  const statusTag = useMemo(() => {
    if (!session) return null;
    if (session.status === "waiting_admin") {
      return <Tag color="orange">{t("support.waitingAdmin")}</Tag>;
    }
    return <Tag color="blue">{t("support.autoReply")}</Tag>;
  }, [session, t]);

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className ?? ""}`}
    >
      <div className="flex items-center justify-between bg-[#2563EB] px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <CustomerServiceOutlined className="text-lg" />
          <div>
            <div className="font-semibold leading-tight">{t("support.title")}</div>
            <div className="text-xs text-blue-100">{t("support.subtitle")}</div>
          </div>
        </div>
        {statusTag}
      </div>

      <SupportConnectionBanner connected={connected} connecting={connecting} />

      {(faqQuery.data?.length ?? 0) > 0 && (
        <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2">
          {faqQuery.data?.map((faq) => (
            <button
              key={faq.id}
              type="button"
              disabled={faqMut.isPending}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-left text-xs leading-snug text-slate-700 wrap-break-word hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
              onClick={() => void handleFaqClick(faq)}
            >
              {faq.question}
            </button>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F9FAFB]">
        <SupportMessageList
          messages={messages}
          perspective="user"
          emptyText={t("support.emptyHint")}
          listRef={listRef}
        />
      </div>

      <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex items-end gap-2">
          <Input.TextArea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("support.inputPlaceholder")}
            autoSize={{ minRows: 1, maxRows: 4 }}
            className="!rounded-xl"
            onKeyDown={(e) => {
              if (!shouldSendOnEnterKey(e)) return;
              e.preventDefault();
              void handleSend();
            }}
          />
          <Button
            type="primary"
            htmlType="button"
            shape="circle"
            size="large"
            icon={<SendOutlined />}
            loading={createSessionMut.isPending || activeSessionQuery.isLoading}
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
}
