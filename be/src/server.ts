import { createApp } from './app'
import { env } from './config/env'
import { prisma } from './lib/prisma'
import { attachSupportWebSocket } from './lib/supportWs'

const start = async () => {
  const app = createApp()

  const server = app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port} (${env.nodeEnv})`)
  })

  attachSupportWebSocket(server)
  console.log('[api] WebSocket support chat enabled at /ws/support')

  const shutdown = async (signal: string) => {
    console.log(`[api] received ${signal}, closing...`)
    server.close()
    await prisma.$disconnect()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

start().catch((err) => {
  console.error('[api] failed to start', err)
  process.exit(1)
})
