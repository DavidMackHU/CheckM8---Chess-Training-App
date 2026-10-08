import { useQuery } from '@tanstack/react-query'
import { apiGet } from './api.ts'

export type LeaderboardPeriod = 'week' | 'all'
export type LeaderboardEntry = { rank: number; username: string; xp: number; streak: number }
export type Leaderboard = {
  period: LeaderboardPeriod
  weekStart: string
  entries: LeaderboardEntry[]
  /** The signed-in user's own place, or null if they are a guest or have no XP in this period. */
  me: { rank: number; xp: number; username: string } | null
}

export function useLeaderboard(period: LeaderboardPeriod) {
  return useQuery({
    queryKey: ['leaderboard', period],
    queryFn: () => apiGet<Leaderboard>(`/leaderboards?period=${period}`),
    staleTime: 30_000,
  })
}
