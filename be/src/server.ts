import { createApp } from './app'
import { env } from './config/env'
import { runManager } from './automation/runManager'
import { profilePreviewManager } from './automation/profilePreviewManager'
import { prisma } from './lib/prisma'

const start = async () => {
  await runManager.init()

  const app = createApp()

  const server = app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port} (${env.nodeEnv})`)
  })

  const shutdown = async (signal: string) => {
    console.log(`[api] received ${signal}, closing...`)
    server.close()
    await profilePreviewManager.closeAll()
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
