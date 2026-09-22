import type { AuthUser, Role } from '../store/useAuthStore'

export type SeedUser = AuthUser & { password: string }

type Database = {
  users: SeedUser[]
}

const DB_KEY = 'license-admin-db'

const seedDatabase = (): Database => ({
  users: [
    {
      id: crypto.randomUUID(),
      email: 'admin@example.com',
      phone: null,
      fullName: 'System Admin',
      password: 'Admin@123',
      role: 'admin',
      status: 'active',
    },
    {
      id: crypto.randomUUID(),
      email: 'user@example.com',
      phone: '0912345678',
      fullName: 'Demo User',
      password: 'User@123',
      role: 'user',
      status: 'active',
    },
  ],
})

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
  phone: user.phone ?? null,
  fullName: user.fullName,
  role: user.role,
  status: user.status,
})

const withDelay = async <T,>(data: T, ms = 200): Promise<T> => {
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
    phone: string
    email?: string | null
    password: string
    role: Role
  }) => {
    const db = readDb()
    const email = payload.email?.trim() || null
    if (email && db.users.some((user) => user.email === email)) {
      throw new Error('Email already exists.')
    }
    if (db.users.some((user) => user.phone === payload.phone)) {
      throw new Error('Phone number already exists.')
    }
    const newUser: SeedUser = {
      id: crypto.randomUUID(),
      fullName: payload.fullName,
      phone: payload.phone,
      email,
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
    if (!target) throw new Error('User not found.')
    target.role = role
    writeDb(db)
    return withDelay(sanitizeUser(target))
  },
}
