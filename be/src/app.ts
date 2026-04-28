import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import morgan from 'morgan'
import { z } from 'zod'
import { db, sanitizeUser, type Role } from './data/mockDb'

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
})

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'user']).default('user'),
})

const toolSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().min(5),
})

const subscriptionSchema = z.object({
  userId: z.string().min(1),
  toolId: z.string().min(1),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
})

const signToken = (userId: string, role: Role) => {
  const secret = process.env.JWT_SECRET || 'super-secret-key'
  return jwt.sign({ sub: userId, role }, secret, { expiresIn: '1d' })
}

export const createApp = () => {
  const app = express()

  app.use(
    cors({
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    }),
  )
  app.use(helmet())
  app.use(morgan('dev'))
  app.use(express.json())
  app.use(cookieParser())

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'tool-admin-api' })
  })

  app.post('/api/auth/login', (req, res) => {
    const parsed = loginSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid login payload.' })
    }

    const user = db.users.find(
      (item) => item.email === parsed.data.email && item.password === parsed.data.password,
    )

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    return res.json({
      user: sanitizeUser(user),
      token: signToken(user.id, user.role),
    })
  })

  app.post('/api/auth/register', (req, res) => {
    const parsed = registerSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid registration payload.' })
    }

    const exists = db.users.some((user) => user.email === parsed.data.email)

    if (exists) {
      return res.status(409).json({ message: 'Email already exists.' })
    }

    const newUser = {
      id: randomUUID(),
      ...parsed.data,
      status: 'active' as const,
    }

    db.users.push(newUser)

    return res.status(201).json({
      user: sanitizeUser(newUser),
      token: signToken(newUser.id, newUser.role),
    })
  })

  app.get('/api/users', (_req, res) => {
    res.json(db.users.map(sanitizeUser))
  })

  app.patch('/api/users/:id/role', (req, res) => {
    const role = req.body.role as Role
    const user = db.users.find((item) => item.id === req.params.id)

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    user.role = role
    return res.json(sanitizeUser(user))
  })

  app.get('/api/tools', (_req, res) => {
    res.json(db.tools)
  })

  app.post('/api/tools', (req, res) => {
    const parsed = toolSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid tool payload.' })
    }

    const tool = {
      id: randomUUID(),
      ...parsed.data,
      type: 'playwright' as const,
      status: 'active' as const,
      createdBy: req.body.createdBy || 'system',
    }

    db.tools.unshift(tool)
    return res.status(201).json(tool)
  })

  app.get('/api/subscriptions', (_req, res) => {
    res.json(db.subscriptions)
  })

  app.post('/api/subscriptions', (req, res) => {
    const parsed = subscriptionSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid subscription payload.' })
    }

    const subscription = {
      id: randomUUID(),
      ...parsed.data,
      status: 'active' as const,
      createdBy: req.body.createdBy || 'system',
    }

    db.subscriptions.unshift(subscription)
    return res.status(201).json(subscription)
  })

  app.get('/api/me/tools/:userId', (req, res) => {
    const activeSubscriptions = db.subscriptions.filter((subscription) => {
      const now = Date.now()
      return (
        subscription.userId === req.params.userId &&
        subscription.status === 'active' &&
        new Date(subscription.startAt).getTime() <= now &&
        new Date(subscription.endAt).getTime() >= now
      )
    })

    res.json(
      activeSubscriptions.map((subscription) => ({
        ...subscription,
        tool: db.tools.find((tool) => tool.id === subscription.toolId) ?? null,
      })),
    )
  })

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err)
    res.status(500).json({ message: 'Internal server error.' })
  })

  return app
}
