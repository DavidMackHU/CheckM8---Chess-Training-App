import { useQuery } from '@tanstack/react-query'
import { apiGet } from './api.ts'
import type { Side } from './courses.ts'

export type HeatmapDay = { date: string; reviews: number; learned: number }

export type CourseProgress = {
  id: string
  slug: string
  title: string
  side: Side
  total: number
  learned: number
  mastered: number
  due: number
  new: number
}

export type Stats = {
  due: number
  newAvailable: number
  newLeftToday: number
  dailyNewLimit: number
  learned: number
  mastered: number
  totalLines: number
  masteredPercent: number
  streak: number
  xp: number
  heatmap: HeatmapDay[]
  courses: CourseProgress[]
}

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => apiGet<Stats>('/stats/me'),
    retry: false,
    // Always fresh when the dashboard opens, e.g. right after a review session.
    staleTime: 0,
    gcTime: 0,
  })
}
