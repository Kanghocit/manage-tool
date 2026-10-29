import type { Server } from 'http'
import { WebSocket, WebSocketServer } from 'ws'

import { getAccessTokenFromCookieHeader } from './authCookies'
import { verifyAccessToken } from './jwt'

type ClientAuth = {
  userId: string
  role: 'admin' | 'user'
}

type ZaloClient = WebSocket & {
  auth?: ClientAuth
  isAlive: boolean
}

const userSockets = new Map<string, Set<ZaloClient>>()

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload))
  }
}

function getUserRoom(userId: string): Set<ZaloClient> {
  let room = userSockets.get(userId)
  if (!room) {
    room = new Set()
    userSockets.set(userId, room)
  }
  return room
}

function cleanupClient(client: ZaloClient) {
  const auth = client.auth
  if (!auth) return
  const room = userSockets.get(auth.userId)
  if (!room) return
  room.delete(client)
  if (room.size === 0) userSockets.delete(auth.userId)
}

export function broadcastToUser(userId: string, payload: unknown) {
  const room = userSockets.get(userId)
  if (!room) return
  for (const client of room) {
    sendJson(client, payload)
  }
}

export function attachZaloWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws/zalo' })

  wss.on('connection', (ws, req) => {
    const client = ws as ZaloClient
    client.isAlive = true

    const url = new URL(req.url ?? '', 'http://localhost')
    const token =
      getAccessTokenFromCookieHeader(req.headers.cookie) ??
      url.searchParams.get('token')?.trim()
    if (!token) {
      sendJson(client, { type: 'error', code: 'UNAUTHORIZED', message: 'Missing token.' })
      client.close()
      return
    }

    try {
      const payload = verifyAccessToken(token)
      client.auth = { userId: payload.sub, role: payload.role }
    } catch {
      sendJson(client, { type: 'error', code: 'UNAUTHORIZED', message: 'Invalid token.' })
      client.close()
      return
    }

    getUserRoom(client.auth.userId).add(client)
    sendJson(client, { type: 'zalo:connected' })

    client.on('pong', () => {
      client.isAlive = true
    })

    client.on('close', () => {
      cleanupClient(client)
    })
  })

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const c = client as ZaloClient
      if (!c.isAlive) {
        cleanupClient(c)
        c.terminate()
        continue
      }
      c.isAlive = false
      c.ping()
    }
  }, 30_000)

  wss.on('close', () => {
    clearInterval(heartbeat)
  })

  return wss
}
