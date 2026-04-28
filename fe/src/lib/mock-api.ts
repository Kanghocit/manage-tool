import dayjs from 'dayjs'
import type { AuthUser, Role } from '../store/useAuthStore'

export type Tool = {
  id: string
  name: string
  slug: string
  description: string
  status: 'active' | 'inactive'
  type: 'playwright'
  createdBy: string
}

export type Subscription = {
  id: string
  userId: string
  toolId: string
  startAt: string
  endAt: string
  status: 'active' | 'expired' | 'cancelled'
  createdBy: string
}

export type SeedUser = AuthUser & {
  password: string
}

type Database = {
  users: SeedUser[]
  tools: Tool[]
  subscriptions: Subscription[]
}

const DB_KEY = 'tool-admin-db'

const seedDatabase = (): Database => {
  const adminId = crypto.randomUUID()
  const userId = crypto.randomUUID()
  const firstToolId = crypto.randomUUID()
  const secondToolId = crypto.randomUUID()

  return {
    users: [
      {
        id: adminId,
        email: 'admin@example.com',
        fullName: 'System Admin',
        password: 'Admin@123',
        role: 'admin',
        status: 'active',
      },
      {
        id: userId,
        email: 'user@example.com',
        fullName: 'Nguyen User',
        password: 'User@123',
        role: 'user',
        status: 'active',
      },
    ],
    tools: [
      {
        id: firstToolId,
        name: 'Google Maps Scraper',
        slug: 'google-maps-scraper',
        description: 'Collect location business data with a Playwright workflow.',
        status: 'active',
        type: 'playwright',
        createdBy: adminId,
      },
      {
        id: secondToolId,
        name: 'TikTok Account Checker',
        slug: 'tiktok-account-checker',
        description: 'Validate creator account states and availability.',
        status: 'active',
        type: 'playwright',
        createdBy: adminId,
      },
    ],
    subscriptions: [
      {
        id: crypto.randomUUID(),
        userId,
        toolId: firstToolId,
        startAt: dayjs().subtract(2, 'day').toISOString(),
        endAt: dayjs().add(28, 'day').toISOString(),
        status: 'active',
        createdBy: adminId,
      },
    ],
  }
}

const readDb = (): Database => {
  const raw = localStorage.getItem(DB_KEY)

  if (!raw) {
    const seeded = seedDatabase()
    localStorage.setItem(DB_KEY, JSON.stringify(seeded))
    return seeded
  }

  return JSON.parse(raw) as Database
}

const writeDb = (db: Database) => {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

const sanitizeUser = (user: SeedUser): AuthUser => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  status: user.status,
})

const withDelay = async <T,>(data: T, ms = 250): Promise<T> => {
  await new Promise((resolve) => window.setTimeout(resolve, ms))
  return data
}

export const mockApi = {
  login: async (email: string, password: string) => {
    const db = readDb()
    const user = db.users.find((item) => item.email === email && item.password === password)

    if (!user) {
      throw new Error('Invalid email or password.')
    }

    return withDelay({
      user: sanitizeUser(user),
      token: `mock-token-${user.id}`,
    })
  },

  register: async (payload: {
    fullName: string
    email: string
    password: string
    role: Role
  }) => {
    const db = readDb()
    const exists = db.users.some((user) => user.email === payload.email)

    if (exists) {
      throw new Error('Email already exists.')
    }

    const newUser: SeedUser = {
      id: crypto.randomUUID(),
      fullName: payload.fullName,
      email: payload.email,
      password: payload.password,
      role: payload.role,
      status: 'active',
    }

    db.users.push(newUser)
    writeDb(db)

    return withDelay({
      user: sanitizeUser(newUser),
      token: `mock-token-${newUser.id}`,
    })
  },

  getUsers: async () => withDelay(readDb().users.map(sanitizeUser)),

  updateUserRole: async (userId: string, role: Role) => {
    const db = readDb()
    const target = db.users.find((user) => user.id === userId)

    if (!target) {
      throw new Error('User not found.')
    }

    target.role = role
    writeDb(db)

    return withDelay(sanitizeUser(target))
  },

  getTools: async () => withDelay(readDb().tools),

  createTool: async (payload: Omit<Tool, 'id'>) => {
    const db = readDb()
    const tool: Tool = {
      ...payload,
      id: crypto.randomUUID(),
    }

    db.tools.unshift(tool)
    writeDb(db)

    return withDelay(tool)
  },

  getSubscriptions: async () => withDelay(readDb().subscriptions),

  createSubscription: async (payload: Omit<Subscription, 'id' | 'status'>) => {
    const db = readDb()
    const status = dayjs(payload.endAt).isAfter(dayjs()) ? 'active' : 'expired'
    const subscription: Subscription = {
      ...payload,
      id: crypto.randomUUID(),
      status,
    }

    db.subscriptions.unshift(subscription)
    writeDb(db)

    return withDelay(subscription)
  },

  getMyTools: async (userId: string) => {
    const db = readDb()
    const now = dayjs()

    const subscriptions = db.subscriptions.filter((subscription) => {
      return (
        subscription.userId === userId &&
        subscription.status === 'active' &&
        dayjs(subscription.startAt).isBefore(now) &&
        dayjs(subscription.endAt).isAfter(now)
      )
    })

    return withDelay(
      subscriptions.map((subscription) => {
        const tool = db.tools.find((item) => item.id === subscription.toolId)

        return {
          ...subscription,
          tool,
        }
      }),
    )
  },
}
