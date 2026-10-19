/**
 * Day arithmetic for streaks and the activity heatmap. Days are calendar days
 * in the player's own time zone (an IANA name such as "America/Chicago"),
 * written "YYYY-MM-DD". UTC when unknown.
 */

const formatters = new Map<string, Intl.DateTimeFormat>()

/** True if `zone` is a time zone this server can calculate with. */
export function isTimeZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || !zone || zone.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

function parts(date: Date, zone: string) {
  let format = formatters.get(zone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(zone, format)
  }
  const get = (type: string) => Number(format.formatToParts(date).find((p) => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

export function dayKey(date: Date, zone = 'UTC'): string {
  const { year, month, day } = parts(date, zone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** The day `n` days after `key` (negative for before). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** How far the zone's wall clock is ahead of UTC at `date`, in ms. */
function offsetAt(date: Date, zone: string): number {
  const p = parts(date, zone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000
}

/** The instant the current day began in `zone`. */
export function startOfDay(now: Date, zone = 'UTC'): Date {
  const { year, month, day } = parts(now, zone)
  const midnight = Date.UTC(year, month - 1, day)
  // Guess with today's offset, then use the offset in force at that guess:
  // they differ on the day clocks change for daylight saving.
  const guess = midnight - offsetAt(now, zone)
  return new Date(midnight - offsetAt(new Date(guess), zone))
}

/** The last `count` days as keys, oldest first, ending with today. */
export function lastDays(count: number, now = new Date(), zone = 'UTC'): string[] {
  const today = dayKey(now, zone)
  return Array.from({ length: count }, (_, i) => addDays(today, i - (count - 1)))
}

/**
 * Consecutive active days ending today. If today has no activity yet, the
 * streak through yesterday still stands, so it does not drop to zero at midnight.
 */
export function currentStreak(activeDays: ReadonlySet<string>, now = new Date(), zone = 'UTC'): number {
  const today = dayKey(now, zone)
  let cursor = activeDays.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (activeDays.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}
