import { useQuery } from '@tanstack/react-query'
import { apiGet } from './api.ts'
import type { DrillCourse } from './train.ts'

export type RatingBucket = 'beginner' | 'club' | 'strong' | 'expert'
export const RATING_LABEL: Record<RatingBucket, string> = {
  beginner: 'Beginner (1000-1400)',
  club: 'Club (1400-1800)',
  strong: 'Strong (1800-2200)',
  expert: 'Expert (2200+)',
}

export type HumanStats = { total: number; moves: { san: string; uci: string; games: number }[] }
export type HumanLine = { id: string; order: number; name: string; moves: string[] }

/** All lines of a course, for Human moves mode. */
export function useHumanCourse(courseId: string) {
  return useQuery({
    queryKey: ['human-course', courseId],
    queryFn: () => apiGet<{ course: DrillCourse; lines: HumanLine[] }>(`/train/human/${encodeURIComponent(courseId)}`),
    retry: false,
    staleTime: Infinity,
  })
}

/** How often real players choose each move from this position. Throws if the data is unavailable. */
export function fetchHumanStats(fen: string, bucket: RatingBucket): Promise<HumanStats> {
  return apiGet<HumanStats>(`/explorer?fen=${encodeURIComponent(fen)}&ratings=${bucket}`)
}

/** The distinct moves the course has at this point, given the moves played so far. */
export function courseReplies(lines: { moves: string[] }[], path: string[]): string[] {
  const next = new Set<string>()
  for (const line of lines) {
    if (line.moves.length > path.length && path.every((san, i) => line.moves[i] === san)) {
      next.add(line.moves[path.length])
    }
  }
  return [...next]
}

export type Reply = {
  san: string
  /** Share of real games in which this move is played here, or null without data. */
  share: number | null
  /** False when the opponent chose a move the course does not cover. */
  inBook: boolean
}

function weightedPick<T>(items: T[], weight: (item: T) => number, random: () => number): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0)
  let roll = random() * total
  for (const item of items) {
    roll -= weight(item)
    if (roll < 0) return item
  }
  return items[items.length - 1]
}

/**
 * Chooses the opponent's reply.
 *  - Normally: one of the course's own replies, weighted by how often humans play it.
 *  - With `mayLeavePrep`: any human move, so the opponent can step outside the course.
 *  - Without data: one of the course's replies, evenly.
 */
export function pickReply(
  branches: string[],
  stats: HumanStats | null,
  mayLeavePrep: boolean,
  random: () => number = Math.random,
): Reply {
  if (!stats || stats.total === 0) {
    return { san: branches[Math.floor(random() * branches.length)], share: null, inBook: true }
  }
  const games = (san: string) => stats.moves.find((m) => m.san === san)?.games ?? 0

  if (mayLeavePrep) {
    const move = weightedPick(stats.moves, (m) => m.games, random)
    return { san: move.san, share: move.games / stats.total, inBook: branches.includes(move.san) }
  }
  // Every course reply keeps a small chance, so rarely played lines still come up now and then.
  const floor = stats.total * 0.01
  const san = weightedPick(branches, (b) => Math.max(games(b), floor), random)
  return { san, share: games(san) / stats.total, inBook: true }
}
