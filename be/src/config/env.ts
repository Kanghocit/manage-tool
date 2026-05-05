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
}
