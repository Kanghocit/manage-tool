/**
 * Draft welcome trial email template — edit subject/body here as needed.
 */
export type WelcomeTrialEmailParams = {
  fullName: string;
  licenseKey: string;
  appUrl: string;
};

export function welcomeTrialEmailSubject(
  _params: WelcomeTrialEmailParams,
): string {
  return "Chào mừng bạn đến với Zalo Tool — License dùng thử 1 ngày";
}

export function welcomeTrialEmailHtml(params: WelcomeTrialEmailParams): string {
  const { fullName, licenseKey, appUrl } = params;
  const activateUrl = `${appUrl.replace(/\/$/, "")}/my-license`;

  return `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155;">
  <p>Xin chào <strong>${escapeHtml(fullName)}</strong>,</p>
  <p>Cảm ơn bạn đã đăng ký tài khoản Zalo Tool.</p>
  <p>Đây là license dùng thử <strong>1 ngày</strong> của bạn:</p>
  <p style="font-size: 18px; font-weight: bold; letter-spacing: 1px; background: #f1f5f9; padding: 12px 16px; border-radius: 8px; display: inline-block;">
    ${escapeHtml(licenseKey)}
  </p>
  <p><strong>Hướng dẫn kích hoạt:</strong></p>
  <ol>
    <li>Đăng nhập vào ứng dụng</li>
    <li>Vào trang <a href="${escapeHtml(activateUrl)}">License của tôi</a></li>
    <li>Nhập license key ở trên và bấm kích hoạt</li>
  </ol>
  <p>Thời hạn license bắt đầu tính từ lúc bạn kích hoạt.</p>
  <p>Trân trọng,<br/>Kang Tools</p>
</body>
</html>`.trim();
}

export function welcomeTrialEmailText(params: WelcomeTrialEmailParams): string {
  const { fullName, licenseKey, appUrl } = params;
  const activateUrl = `${appUrl.replace(/\/$/, "")}/my-license`;

  return [
    `Xin chào ${fullName},`,
    "",
    "Cảm ơn bạn đã đăng ký tài khoản Kang Tools.",
    "",
    "Đây là license dùng thử 1 ngày của bạn:",
    licenseKey,
    "",
    "Hướng dẫn kích hoạt:",
    "1. Đăng nhập vào ứng dụng",
    `2. Vào trang License của tôi: ${activateUrl}`,
    "3. Nhập license key và bấm kích hoạt",
    "",
    "Thời hạn license bắt đầu tính từ lúc bạn kích hoạt.",
    "",
    "Trân trọng,",
    "Kang Tools",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
