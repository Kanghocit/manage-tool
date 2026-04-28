import { randomUUID } from 'node:crypto'

export type Role = 'admin' | 'user'

export type User = {
  id: string
  email: string
  password: string
  fullName: string
  role: Role
  status: 'active' | 'inactive'
}

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

const adminId = randomUUID()
const userId = randomUUID()
const toolId = randomUUID()

export const db: {
  users: User[]
  tools: Tool[]
  subscriptions: Subscription[]
} = {
  users: [
    {
      id: adminId,
      email: 'admin@example.com',
      password: 'Admin@123',
      fullName: 'System Admin',
      role: 'admin',
      status: 'active',
    },
    {
      id: userId,
      email: 'user@example.com',
      password: 'User@123',
      fullName: 'Nguyen User',
      role: 'user',
      status: 'active',
    },
  ],
  tools: [
    {
      id: toolId,
      name: 'Google Maps Scraper',
      slug: 'google-maps-scraper',
      description: 'Collect business data by Playwright automation.',
      status: 'active',
      type: 'playwright',
      createdBy: adminId,
    },
  ],
  subscriptions: [
    {
      id: randomUUID(),
      userId,
      toolId,
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      status: 'active',
      createdBy: adminId,
    },
  ],
}

export const sanitizeUser = (user: User) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  status: user.status,
})
