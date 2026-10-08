import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, apiGet, apiPost } from './api.ts'

export type User = {
  id: string
  email: string
  username: string
  xp: number
  streak: number
  dailyNewLimit: number
  createdAt: string
}

export type Credentials = { email: string; password: string; username?: string }

const ME_KEY = ['auth', 'me'] as const

/** The signed-in user, or null for guests. */
export function useCurrentUser() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async (): Promise<User | null> => {
      try {
        return (await apiGet<{ user: User }>('/auth/me')).user
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

function useAuthMutation(path: '/auth/login' | '/auth/register') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentials: Credentials) => apiPost<{ user: User }>(path, credentials),
    onSuccess: ({ user }) => queryClient.setQueryData(ME_KEY, user),
  })
}

export const useLogin = () => useAuthMutation('/auth/login')
export const useRegister = () => useAuthMutation('/auth/register')

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<void>('/auth/logout'),
    onSuccess: () => queryClient.setQueryData(ME_KEY, null),
  })
}
