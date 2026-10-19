import type { Prisma } from '../generated/prisma/client.js'
import { addDays, dayKey } from './activity.js'
import type { Grade } from './scheduler.js'

/** XP for learning a new line with hints. */
export const XP_LEARNED = 5

/** XP for a review, by grade. A clean line is worth more; a missed one still earns something for showing up. */
export const XP_REVIEW: Record<Grade, number> = { AGAIN: 4, HARD: 8, GOOD: 10, EASY: 12 }

/** ReviewLog.rating value that marks "learned a new line" (real reviews use 1 to 4). */
export const RATING_LEARNED = 0

const DAY_MS = 24 * 60 * 60 * 1000

/** The streak after being active on `today`, given the stored streak and its last active day. */
export function nextStreak(streak: number, lastActive: Date | null, now: Date, zone = 'UTC'): number {
  if (!lastActive) return 1
  const today = dayKey(now, zone)
  const last = dayKey(lastActive, zone)
  if (last === today) return Math.max(1, streak)
  if (last === addDays(today, -1)) return streak + 1
  return 1
}

/** A stored streak only still counts if the user was active today or yesterday. */
export function liveStreak(streak: number, lastActive: Date | null, now = new Date(), zone = 'UTC'): number {
  if (!lastActive) return 0
  const last = dayKey(lastActive, zone)
  const today = dayKey(now, zone)
  return last === today || last === addDays(today, -1) ? streak : 0
}

/**
 * Adds XP and advances the daily streak, in the player's time zone (remembered
 * for the leaderboards). Call inside the same transaction as the activity itself.
 */
export async function recordActivity(tx: Prisma.TransactionClient, userId: string, xp: number, zone = 'UTC', now = new Date()) {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { streak: true, lastActiveDate: true },
  })
  return tx.user.update({
    where: { id: userId },
    data: {
      xp: { increment: xp },
      streak: nextStreak(user.streak, user.lastActiveDate, now, zone),
      lastActiveDate: now,
      timeZone: zone,
    },
    select: { xp: true, streak: true },
  })
}

/** Monday 00:00 UTC of the week containing `now`. The weekly leaderboard resets here. */
export function startOfWeek(now = new Date()): Date {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const daysSinceMonday = (now.getUTCDay() + 6) % 7
  return new Date(midnight - daysSinceMonday * DAY_MS)
}
