import { create } from 'zustand'

export type Role = 'admin' | 'user'

export type AuthUser = {
  id: string
  email: string
  fullName: string
  role: Role
  status: 'active' | 'inactive'
}

type AuthState = {
  user: AuthUser | null
  token: string | null
  setSession: (user: AuthUser, token: string) => void
  logout: () => void
  hydrate: () => void
}

const STORAGE_KEY = 'tool-admin-auth'

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setSession: (user, token) => {
    const payload = { user, token }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    set(payload)
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ user: null, token: null })
  },
  hydrate: () => {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw) as { user: AuthUser; token: string }
      set(parsed)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  },
}))
