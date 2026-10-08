import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost } from './api.ts'

export type Side = 'WHITE' | 'BLACK'
export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

export type CourseCard = {
  id: string
  slug: string
  title: string
  pitch: string
  side: Side
  difficulty: Difficulty
  keyMoves: string[]
  keyFen: string
  isOfficial: boolean
  upvotes: number
  author: string
  lineCount: number
}

export type CourseDetail = CourseCard & {
  description: string
  startFen: string
  enrolled: boolean
  /** True when the viewer has upvoted this course. */
  upvoted: boolean
  isPublic: boolean
  /** True when the viewer wrote this course. */
  isOwner: boolean
}
export type CourseLine = { id: string; order: number; name: string; moves: string[]; finalFen: string }

/** Catalog filters. Empty string means "any". */
export type CourseFilterValues = {
  q: string
  side: '' | 'white' | 'black'
  first: '' | 'e4' | 'd4' | 'other'
  difficulty: '' | 'beginner' | 'intermediate' | 'advanced'
  community: '' | 'true' | 'false'
  /** '' = official first, then most upvoted. 'new' = most recently published first. */
  sort: '' | 'new'
}

export const EMPTY_FILTERS: CourseFilterValues = { q: '', side: '', first: '', difficulty: '', community: '', sort: '' }

export function useCourses(filters: CourseFilterValues) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  const query = params.toString()
  return useQuery({
    queryKey: ['courses', query],
    queryFn: async () => (await apiGet<{ courses: CourseCard[] }>(`/courses${query ? `?${query}` : ''}`)).courses,
    placeholderData: (previous) => previous, // Keep the old grid visible while a filter change loads.
  })
}

export function useCourse(slug: string) {
  return useQuery({
    queryKey: ['course', slug],
    queryFn: () => apiGet<{ course: CourseDetail; lines: CourseLine[] }>(`/courses/${encodeURIComponent(slug)}`),
    retry: false,
  })
}

export function useEnroll(course: { id: string; slug: string }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<{ enrolled: boolean }>(`/courses/${course.id}/enroll`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course', course.slug] }),
  })
}

export function useUpvote(course: { id: string; slug: string }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (on: boolean) =>
      on
        ? apiPost<{ upvotes: number; upvoted: boolean }>(`/courses/${course.id}/upvote`)
        : apiDelete<{ upvotes: number; upvoted: boolean }>(`/courses/${course.id}/upvote`),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['course', course.slug] }),
        queryClient.invalidateQueries({ queryKey: ['courses'] }),
      ]),
  })
}

export const SIDE_LABEL: Record<Side, string> = { WHITE: 'White', BLACK: 'Black' }
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
}

/** "1. d4 d5 2. Bf4" from a list of SAN moves. */
export function formatMoves(moves: string[]): string {
  return moves.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san)).join(' ')
}
