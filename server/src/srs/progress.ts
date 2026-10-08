import type { Prisma } from '../generated/prisma/client.js'
import { dayKey } from './activity.js'
import type { Grade } from './scheduler.js'

/** XP for learning a new line with hints. */
export const XP_LEARNED = 5

/** XP for a review, by grade. A clean line is worth more; a missed one still earns something for showing up. */
export const XP_REVIEW: Record<Grade, number> = { AGAIN: 4, HARD: 8, GOOD: 10, EASY: 12 }

/** ReviewLog.rating value that marks "learned a new line" (real reviews use 1 to 4). */
export const RATING_LEARNED = 0

const DAY_MS = 24 * 60 * 60 * 1000

/** The streak after being active on `today`, given the stored streak and its last active day. */
export function nextStreak(streak: number, lastActive: Date | null, now: Date): number {
  if (!lastActive) return 1
  const today = dayKey(now)
  if (dayKey(lastActive) === today) return Math.max(1, streak)
  if (dayKey(lastActive) === dayKey(new Date(now.getTime() - DAY_MS))) return streak + 1
  return 1
}

/** A stored streak only still counts if the user was active today or yesterday. */
export function liveStreak(streak: number, lastActive: Date | null, now = new Date()): number {
  if (!lastActive) return 0
  const last = dayKey(lastActive)
  return last === dayKey(now) || last === dayKey(new Date(now.getTime() - DAY_MS)) ? streak : 0
}

/** Adds XP and advances the daily streak. Call inside the same transaction as the activity itself. */
export async function recordActivity(tx: Prisma.TransactionClient, userId: string, xp: number, now = new Date()) {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { streak: true, lastActiveDate: true },
  })
  return tx.user.update({
    where: { id: userId },
    data: {
      xp: { increment: xp },
      streak: nextStreak(user.streak, user.lastActiveDate, now),
      lastActiveDate: now,
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
