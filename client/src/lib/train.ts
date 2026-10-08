import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from './api.ts'
import type { Side } from './courses.ts'

/** A line as the drill needs it. `comments` maps ply number (1-based) to text. */
export type DrillLine = {
  id: string
  order: number
  name: string
  moves: string[]
  comments: Record<string, string>
  finalFen: string
}

export type DrillCourse = { id: string; slug: string; title: string; side: Side; startFen: string }

export type LearnSession = {
  course: DrillCourse
  lines: DrillLine[]
  newInCourse: number
  totalInCourse: number
  learnedToday: number
  dailyNewLimit: number
}

/** New lines to learn in a course, limited by the user's daily allowance. */
export function useLearnSession(courseId: string) {
  return useQuery({
    queryKey: ['learn', courseId],
    queryFn: () => apiGet<LearnSession>(`/train/learn/${encodeURIComponent(courseId)}`),
    retry: false,
    // The session is a fixed batch of lines. Refetching mid-drill would swap them out.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
}

/** Guest preview: line 1 of any course, no account needed. */
export function useFirstLine(slug: string) {
  return useQuery({
    queryKey: ['first-line', slug],
    queryFn: () => apiGet<{ course: DrillCourse; line: DrillLine }>(`/courses/${encodeURIComponent(slug)}/first-line`),
    retry: false,
    staleTime: Infinity,
  })
}

export function useMarkLearned() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (lineId: string) => apiPost<{ card: { id: string; due: string }; xpEarned: number }>('/train/learned', { lineId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course'] }),
  })
}

/** How a drill went. avgMs and maxMs cover only moves the user got right first try. */
export type DrillResult = { mistakes: number; ms: number; avgMs: number; maxMs: number }

export type ReviewItem = { line: DrillLine; course: DrillCourse; due: string }
export type ReviewQueue = { items: ReviewItem[]; dueCount: number }

/** Lines that are due for review now, oldest first, across all enrolled courses. */
export function useReviewQueue() {
  return useQuery({
    queryKey: ['review-queue'],
    queryFn: () => apiGet<ReviewQueue>('/train/review'),
    retry: false,
    // A session works through a fixed batch. Refetching mid-drill would reshuffle it.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
}

export type Grade = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'
export type ReviewOutcome = {
  grade: Grade
  due: string
  scheduledDays: number
  lapses: number
  xpEarned: number
  totalXp: number
  streak: number
}

export function useSubmitResult() {
  return useMutation({
    mutationFn: (input: { lineId: string; mistakes: number; avgMs: number; maxMs: number }) =>
      apiPost<ReviewOutcome>('/train/result', input),
  })
}
