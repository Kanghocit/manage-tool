import axios, { type AxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/useAuthStore'

function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL
  if (configured) return configured
  if (import.meta.env.DEV) return ''
  return 'http://localhost:4000'
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
})

let refreshPromise: Promise<boolean> | null = null

async function refreshSession(): Promise<boolean> {
  try {
    await api.post('/api/auth/refresh')
    return true
  } catch {
    return false
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as { _retry?: boolean; url?: string } | undefined
    const status = error?.response?.status as number | undefined
    const errorCode = error?.response?.data?.code as string | undefined

    if (status === 401 && errorCode === 'USER_NOT_FOUND') {
      useAuthStore.getState().logout()
      throw error
    }

    const url = original?.url ?? ''
    const isAuthRoute =
      url.includes('/api/auth/me') ||
      url.includes('/api/auth/refresh') ||
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/logout')

    if (!original || status !== 401 || original._retry || isAuthRoute) {
      throw error
    }

    original._retry = true

    if (!refreshPromise) {
      refreshPromise = refreshSession().finally(() => {
        refreshPromise = null
      })
    }

    const refreshed = await refreshPromise
    if (!refreshed) {
      useAuthStore.getState().logout()
      throw error
    }

    return api.request(original as AxiosRequestConfig)
  },
)
