import 'dotenv/config'

const required = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback
  if (!value) {
    throw new Error(`Missing required env: ${key}`)
  }
  return value
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/license_admin?schema=public'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
    accessTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
    refreshTtl: process.env.REFRESH_TOKEN_TTL ?? '30d',
  },

  licenseKeyPepper: required('LICENSE_KEY_PEPPER', 'dev-license-pepper'),
  refreshTokenPepper: required('REFRESH_TOKEN_PEPPER', 'dev-refresh-pepper'),

  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),

  allowRegister: (process.env.ALLOW_REGISTER ?? 'false').toLowerCase() === 'true',

  /** Public app URL for links in emails */
  appPublicUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:5173',

  /** SMTP (nodemailer) — optional; required to send welcome emails */
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'Kang Tools <noreply@example.com>',
  },

  /** VietQR image (img.vietqr.io) — bank code e.g. MB, VCB */
  vietQr: {
    bankCode: process.env.VIETQR_BANK_CODE ?? '',
    accountNo: process.env.VIETQR_ACCOUNT_NO ?? '',
    accountName: process.env.VIETQR_ACCOUNT_NAME ?? '',
  },

  /** SePay webhook: Authorization: Apikey <value> */
  sepayWebhookApiKey: process.env.SEPAY_WEBHOOK_API_KEY ?? '',

  /**
   * Optional: static QR image URL from SePay / bank (e.g. merchant QR in SePay dashboard).
   * Used when dynamic QR URLs are not set. Amount + memo must still match the order in the app.
   */
  sepayCheckoutQrUrl: process.env.SEPAY_CHECKOUT_QR_URL ?? '',

  /**
   * Dynamic QR via SePay: https://qr.sepay.vn/img?acc=&bank=&amount=&des=
   * `acc` defaults to VIETQR_ACCOUNT_NO if SEPAY_QR_ACC is empty.
   */
  sepayQr: {
    acc: process.env.SEPAY_QR_ACC ?? '',
    bank: process.env.SEPAY_QR_BANK ?? '',
    template: process.env.SEPAY_QR_TEMPLATE ?? '',
  },

  /** Telegram Bot API — notify admin on license request */
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    chatId: process.env.TELEGRAM_CHAT_ID ?? '',
  },

}

export function isSmtpConfigured(): boolean {
  return Boolean(env.smtp.host && env.smtp.user && env.smtp.pass)
}
