import { create } from 'zustand'

export type Role = 'admin' | 'user'

export type AuthUser = {
  id: string
  email: string
  fullName: string
  role: Role
  status: 'active' | 'blocked'
}

type AuthState = {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  setSession: (user: AuthUser, accessToken: string, refreshToken: string) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  logout: () => void
  hydrate: () => void
}

const STORAGE_KEY = 'license-admin-auth'

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
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
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw) as { user: AuthUser; accessToken: string; refreshToken: string }
      set(parsed)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  },
}))
