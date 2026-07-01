import { env } from "../config/env";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Sends a message via Telegram Bot API. No-op if not configured.
 * Fire-and-forget safe: logs errors, never throws.
 */
export async function sendTelegramMessage(text: string): Promise<void> {
  const { botToken, chatId } = env.telegram;
  if (!botToken || !chatId) {
    console.warn("[telegram] Skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set");
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[telegram] sendMessage failed:", res.status, body);
    }
  } catch (err) {
    console.error("[telegram] sendMessage error:", err);
  }
}

export function formatLicenseRequestTelegramMessage(input: {
  requestId: string;
  userEmail: string;
  userFullName: string;
  note: string | null;
  createdAt: Date;
}): string {
  const lines = [
    "<b>📋 Yêu cầu cấp license 1 ngày</b>",
    "",
    `<b>User:</b> ${escapeHtml(input.userFullName)}`,
    `<b>Email:</b> ${escapeHtml(input.userEmail)}`,
    `<b>Thời gian:</b> ${escapeHtml(input.createdAt.toISOString())}`,
    `<b>Request ID:</b> <code>${escapeHtml(input.requestId)}</code>`,
  ];

  if (input.note?.trim()) {
    lines.push("", `<b>Ghi chú:</b> ${escapeHtml(input.note.trim())}`);
  }

  lines.push("", "Vui lòng duyệt trên trang admin.");
  return lines.join("\n");
}
