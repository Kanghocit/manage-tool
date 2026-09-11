import { create } from 'zustand'

export type Role = 'admin' | 'user'

export type AuthUser = {
  id: string
  email: string
  fullName: string
  role: Role
  status: 'active' | 'blocked'
}

type StoredSession = {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

type AuthState = {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  hasHydrated: boolean
  setSession: (user: AuthUser, accessToken: string, refreshToken: string) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  logout: () => void
  hydrate: () => void
}

const STORAGE_KEY = 'license-admin-auth'

function readStoredSession(): StoredSession | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as StoredSession
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

const initialSession = readStoredSession()

export const useAuthStore = create<AuthState>((set) => ({
  user: initialSession?.user ?? null,
  accessToken: initialSession?.accessToken ?? null,
  refreshToken: initialSession?.refreshToken ?? null,
  hasHydrated: true,
  setSession: (user, accessToken, refreshToken) => {
    const payload = { user, accessToken, refreshToken }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    set(payload)
  },
  setTokens: (accessToken, refreshToken) => {
    set((state) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: state.user, accessToken, refreshToken }))
      return { accessToken, refreshToken }
    })
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ user: null, accessToken: null, refreshToken: null })
  },
  hydrate: () => {
    const stored = readStoredSession()
    if (stored) {
      set(stored)
    }
    set({ hasHydrated: true })
  },
}))
