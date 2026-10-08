import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost, apiPut } from './api.ts'
import type { Difficulty, Side } from './courses.ts'
import type { EditorLine } from './moveTree.ts'

export type MyCourse = { id: string; slug: string; title: string; side: Side; isPublic: boolean; lineCount: number }

export type EditableCourse = {
  id: string
  slug: string
  title: string
  pitch: string
  description: string
  side: Side
  difficulty: Difficulty
  isPublic: boolean
}

export type CourseDraft = Pick<EditableCourse, 'title' | 'pitch' | 'description' | 'side' | 'difficulty'> & {
  lines: EditorLine[]
}

export function useMyCourses() {
  return useQuery({
    queryKey: ['creator', 'courses'],
    queryFn: async () => (await apiGet<{ courses: MyCourse[] }>('/creator/courses')).courses,
    retry: false,
  })
}

export function useEditableCourse(id: string) {
  return useQuery({
    queryKey: ['creator', 'course', id],
    queryFn: () => apiGet<{ course: EditableCourse; lines: EditorLine[] }>(`/creator/courses/${encodeURIComponent(id)}`),
    retry: false,
    // The editor holds unsaved work; never swap its data out from under it.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

export function useCreateCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { title: string; side: Side; pgn?: string }) =>
      apiPost<{ course: { id: string; slug: string }; lineCount: number; warnings: string[] }>('/creator/courses', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['creator', 'courses'] }),
  })
}

export function useSaveCourse(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (draft: CourseDraft) =>
      apiPut<{ saved: boolean; lineCount: number; warnings: string[] }>(`/creator/courses/${id}`, draft),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['creator'] }),
        queryClient.invalidateQueries({ queryKey: ['course'] }),
      ]),
  })
}

export function useDeleteCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/creator/courses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['creator', 'courses'] }),
  })
}

/** Publishes a course to the community catalog, or takes it back to private. */
export function usePublishCourse(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (publish: boolean) =>
      apiPost<{ isPublic: boolean }>(`/creator/courses/${id}/${publish ? 'publish' : 'unpublish'}`),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['creator'] }),
        queryClient.invalidateQueries({ queryKey: ['course'] }),
        queryClient.invalidateQueries({ queryKey: ['courses'] }),
      ]),
  })
}

/** Asks the server to read a PGN. Nothing is saved; the lines come back for the editor. */
export function useParsePgn() {
  return useMutation({
    mutationFn: (input: { pgn: string; side: Side }) =>
      apiPost<{ lines: EditorLine[]; warnings: string[] }>('/creator/parse-pgn', input),
  })
}
