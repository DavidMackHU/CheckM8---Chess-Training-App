/**
 * Day arithmetic for streaks and the activity heatmap. Days are UTC calendar
 * days, written "YYYY-MM-DD".
 */

const DAY_MS = 24 * 60 * 60 * 1000

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** The last `count` days as keys, oldest first, ending with today. */
export function lastDays(count: number, now = new Date()): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Array.from({ length: count }, (_, i) => dayKey(new Date(today - (count - 1 - i) * DAY_MS)))
}

/**
 * Consecutive active days ending today. If today has no activity yet, the
 * streak through yesterday still stands, so it does not drop to zero at midnight.
 */
export function currentStreak(activeDays: ReadonlySet<string>, now = new Date()): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  let cursor = activeDays.has(dayKey(new Date(today))) ? today : today - DAY_MS
  let streak = 0
  while (activeDays.has(dayKey(new Date(cursor)))) {
    streak++
    cursor -= DAY_MS
  }
  return streak
}
