import axios, { type AxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/useAuthStore'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken
  if (accessToken) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as { _retry?: boolean } | undefined
    const status = error?.response?.status as number | undefined

    if (!original || status !== 401 || original._retry) {
      throw error
    }

    original._retry = true

    if (!refreshPromise) {
      refreshPromise = (async () => {
        const refreshToken = useAuthStore.getState().refreshToken
        if (!refreshToken) return null

        const res = await api.post('/api/auth/refresh', { refreshToken })
        const newAccess = res.data?.accessToken as string | undefined
        const newRefresh = res.data?.refreshToken as string | undefined

        if (!newAccess || !newRefresh) return null

        useAuthStore.getState().setTokens(newAccess, newRefresh)
        return newAccess
      })().finally(() => {
        refreshPromise = null
      })
    }

    const token = await refreshPromise
    if (!token) {
      useAuthStore.getState().logout()
      throw error
    }

    return api.request(original as AxiosRequestConfig)
  },
)

