export type SupportFaqItem = {
  id: string;
  question: string;
  keywords: string[];
  answer: string;
};

export const supportFaqItems: SupportFaqItem[] = [
  {
    id: "license-expired",
    question: "License hết hạn",
    keywords: ["het han", "hết hạn", "expired", "expire", "gia han", "gia hạn"],
    answer:
      "License hết hạn khi đủ số ngày đã mua. Bạn vào mục License của tôi để xem ngày hết hạn và mua gói mới nếu cần.",
  },
  {
    id: "activation-failed",
    question: "Không kích hoạt được license",
    keywords: [
      "kich hoat",
      "kích hoạt",
      "activate",
      "activation",
      "khong kich hoat",
      "không kích hoạt",
      "loi license",
      "lỗi license",
    ],
    answer:
      "Kiểm tra license key đã nhập đúng, thiết bị chưa bị gắn tài khoản khác, và extension đang dùng cùng thiết bị đã đăng ký. Nếu vẫn lỗi, bấm Liên hệ admin.",
  },
  {
    id: "forgot-password",
    question: "Quên mật khẩu",
    keywords: ["quen mat khau", "quên mật khẩu", "forgot password", "reset password", "doi mat khau"],
    answer:
      "Hiện chưa có tự động reset mật khẩu qua email. Vui lòng bấm Liên hệ admin và cung cấp email đăng ký để được hỗ trợ.",
  },
  {
    id: "payment",
    question: "Cách thanh toán / mua license",
    keywords: ["thanh toan", "thanh toán", "payment", "mua", "qr", "sepay", "chuyen khoan", "chuyển khoản"],
    answer:
      "Vào License của tôi → chọn gói → quét QR/chuyển khoản đúng nội dung chuyển khoản hiển thị. Hệ thống tự kích hoạt sau khi nhận tiền (thường vài phút).",
  },
  {
    id: "device-bound",
    question: "Tài khoản gắn thiết bị khác",
    keywords: ["thiet bi", "thiết bị", "device", "extension khac", "gắn", "gan thiet bi"],
    answer:
      "Mỗi tài khoản gắn với một thiết bị/extension. Nếu đổi máy, liên hệ admin để gỡ ràng buộc thiết bị cũ.",
  },
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

export function matchSupportFaq(content: string): SupportFaqItem | null {
  const normalized = normalizeText(content);
  if (!normalized) return null;

  for (const item of supportFaqItems) {
    if (item.keywords.some((kw) => normalized.includes(normalizeText(kw)))) {
      return item;
    }
  }

  return null;
}
