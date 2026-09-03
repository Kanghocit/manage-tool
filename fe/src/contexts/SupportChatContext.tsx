import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type SupportChatContextValue = {
  open: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
};

const SupportChatContext = createContext<SupportChatContextValue | null>(null);

export function SupportChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openChat = useCallback(() => setOpen(true), []);
  const closeChat = useCallback(() => setOpen(false), []);
  const toggleChat = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ open, openChat, closeChat, toggleChat }),
    [open, openChat, closeChat, toggleChat],
  );

  return (
    <SupportChatContext.Provider value={value}>{children}</SupportChatContext.Provider>
  );
}

export function useSupportChat() {
  const ctx = useContext(SupportChatContext);
  if (!ctx) {
    throw new Error("useSupportChat must be used within SupportChatProvider");
  }
  return ctx;
}

/** Safe hook when provider may be absent (e.g. login page) */
export function useSupportChatOptional() {
  return useContext(SupportChatContext);
}
