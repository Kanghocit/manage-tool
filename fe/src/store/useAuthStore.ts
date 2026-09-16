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
  hasHydrated: boolean
  setUser: (user: AuthUser) => void
  logout: () => void
  bootstrapSession: () => Promise<void>
}

const LEGACY_STORAGE_KEY = 'license-admin-auth'

let bootstrapPromise: Promise<void> | null = null

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  hasHydrated: false,
  setUser: (user) => set({ user, hasHydrated: true }),
  logout: () => set({ user: null, hasHydrated: true }),
  bootstrapSession: async () => {
    if (get().hasHydrated) return
    if (bootstrapPromise) return bootstrapPromise

    bootstrapPromise = (async () => {
      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY)
        const { api } = await import('../lib/api')

        const fetchCurrentUser = async (): Promise<AuthUser | null> => {
          try {
            const res = await api.get<{ success: boolean; user: AuthUser }>('/api/auth/me')
            return res.data.user ?? null
          } catch {
            return null
          }
        }

        let user = await fetchCurrentUser()
        if (!user) {
          try {
            await api.post('/api/auth/refresh')
            user = await fetchCurrentUser()
          } catch {
            user = null
          }
        }

        set({ user, hasHydrated: true })
      } catch {
        set({ user: null, hasHydrated: true })
      } finally {
        bootstrapPromise = null
      }
    })()

    return bootstrapPromise
  },
}))
