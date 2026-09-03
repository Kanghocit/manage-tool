import { useLayoutEffect, useRef } from "react";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

import type { SupportMessage } from "../../types/support";

type BubbleProps = {
  message: SupportMessage;
  /** user side: own messages on the right */
  perspective: "user" | "admin";
};

function senderLabel(
  sender: SupportMessage["sender"],
  t: (key: string) => string,
): string {
  if (sender === "bot") return t("support.senderBot");
  if (sender === "admin") return t("support.senderAdmin");
  return t("support.senderUser");
}

function initials(sender: SupportMessage["sender"]): string {
  if (sender === "bot") return "AI";
  if (sender === "admin") return "AD";
  return "ME";
}

export function SupportMessageBubble({ message, perspective }: BubbleProps) {
  const { t } = useTranslation();
  const isOwn =
    perspective === "user"
      ? message.sender === "user"
      : message.sender === "admin";
  const isBot = message.sender === "bot";

  const bubbleClass = isOwn
    ? "bg-[#2563EB] text-white rounded-br-md"
    : isBot
      ? "bg-violet-50 text-violet-900 border border-violet-100 rounded-bl-md"
      : "bg-white text-slate-800 border border-slate-200 rounded-bl-md shadow-sm";

  const avatarClass = isOwn
    ? "bg-[#2563EB] text-white"
    : isBot
      ? "bg-violet-500 text-white"
      : "bg-slate-400 text-white";

  return (
    <div className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${avatarClass}`}
      >
        {initials(message.sender)}
      </div>
      <div className={`max-w-[78%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
        <span className="mb-0.5 text-[11px] font-medium text-slate-500">
          {senderLabel(message.sender, t)}
        </span>
        <div className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${bubbleClass}`}>
          {message.content}
        </div>
        <span className="mt-1 text-[10px] text-slate-400">
          {dayjs(message.createdAt).format("HH:mm")}
        </span>
      </div>
    </div>
  );
}

type ListProps = {
  messages: SupportMessage[];
  perspective: "user" | "admin";
  emptyText: string;
  listRef?: React.RefObject<HTMLDivElement | null>;
};

export function SupportMessageList({
  messages,
  perspective,
  emptyText,
  listRef,
}: ListProps) {
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scrollEl = innerRef.current;
    const scrollToBottom = () => {
      if (!scrollEl) return;
      scrollEl.scrollTop = scrollEl.scrollHeight;
    };
    scrollToBottom();
    requestAnimationFrame(scrollToBottom);
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center px-4 text-center">
        <div className="mb-2 text-3xl opacity-40">💬</div>
        <p className="text-sm text-slate-500">{emptyText}</p>
      </div>
    );
  }

  return (
    <div
      ref={(node) => {
        innerRef.current = node;
        if (listRef) {
          (listRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      }}
      className="h-full min-h-0 overflow-y-auto overscroll-contain p-4"
    >
      <div className="flex flex-col gap-3">
        {messages.map((msg) => (
          <SupportMessageBubble key={msg.id} message={msg} perspective={perspective} />
        ))}
      </div>
    </div>
  );
}

export function SupportConnectionBanner({
  connected,
  connecting,
}: {
  connected: boolean;
  connecting: boolean;
}) {
  const { t } = useTranslation();
  if (connected) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
      {connecting ? t("support.connecting") : t("support.reconnecting")}
    </div>
  );
}
