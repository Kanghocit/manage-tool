export type SupportMessageSender = "user" | "bot" | "admin";

export type SupportSessionStatus = "open" | "waiting_admin";

export type SupportMessage = {
  id: string;
  sessionId: string;
  sender: SupportMessageSender;
  content: string;
  createdAt: string;
};

export type SupportSession = {
  id: string;
  userId: string;
  status: SupportSessionStatus;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
  };
  messages?: SupportMessage[];
};

export type SupportFaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type SupportWsEvent =
  | { type: "connected"; role: "admin" | "user" }
  | { type: "session:joined"; sessionId: string }
  | { type: "session:escalated"; session: SupportSession }
  | { type: "session:deleted"; sessionId: string }
  | { type: "message:new"; sessionId: string; message: SupportMessage }
  | { type: "error"; code: string; message: string };
