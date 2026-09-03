import type { SupportMessage, SupportMessageSender, SupportSession, SupportSessionStatus, User } from "@prisma/client";

export type SerializedSupportMessage = {
  id: string;
  sessionId: string;
  sender: SupportMessageSender;
  content: string;
  createdAt: string;
};

export type SerializedSupportSession = {
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
  messages?: SerializedSupportMessage[];
};

export function serializeMessage(row: SupportMessage): SerializedSupportMessage {
  return {
    id: row.id,
    sessionId: row.sessionId,
    sender: row.sender,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeSession(
  row: SupportSession & {
    user?: Pick<User, "id" | "email" | "fullName">;
    messages?: SupportMessage[];
  },
): SerializedSupportSession {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    user: row.user
      ? { id: row.user.id, email: row.user.email, fullName: row.user.fullName }
      : undefined,
    messages: row.messages?.map(serializeMessage),
  };
}
