import { useState } from 'react'
import type { HeatmapDay } from '../lib/stats.ts'

type Props = {
  /** Consecutive days, oldest first, ending today. */
  days: HeatmapDay[]
}

// One hue, darker to brighter as activity grows (the surface is dark, so brighter reads as "more").
const LEVELS = ['bg-slate-800', 'bg-emerald-800', 'bg-emerald-600', 'bg-emerald-400', 'bg-emerald-200']
const CELL = 'h-4 w-4 sm:h-5 sm:w-5'
const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', '']

function level(total: number): number {
  if (total === 0) return 0
  if (total <= 2) return 1
  if (total <= 5) return 2
  if (total <= 9) return 3
  return 4
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function describe(day: HeatmapDay): string {
  const date = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  if (day.reviews + day.learned === 0) return `${date}: no activity`
  return `${date}: ${plural(day.reviews, 'review')}, ${plural(day.learned, 'new line')}`
}

/** Activity calendar: one square per day, one column per week (Monday at the top). */
export default function Heatmap({ days }: Props) {
  const [hovered, setHovered] = useState<HeatmapDay | null>(null)
  if (days.length === 0) return null

  // Blank cells before the first day so that each row is one weekday.
  const firstWeekday = (new Date(`${days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7
  const activeDays = days.filter((d) => d.reviews + d.learned > 0).length

  return (
    <div className="flex flex-col gap-3" data-testid="heatmap">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <div className="grid grid-rows-7 gap-1 text-[10px] leading-3 text-slate-500" aria-hidden="true">
          {WEEKDAYS.map((name, i) => (
            <span key={i} className="flex h-4 items-center sm:h-5">
              {name}
            </span>
          ))}
        </div>
        <div className="grid grid-flow-col grid-rows-7 gap-1" onMouseLeave={() => setHovered(null)}>
          {Array.from({ length: firstWeekday }, (_, i) => (
            <span key={`pad-${i}`} className={CELL} />
          ))}
          {days.map((day) => (
            <button
              key={day.date}
              type="button"
              data-date={day.date}
              data-level={level(day.reviews + day.learned)}
              aria-label={describe(day)}
              title={describe(day)}
              onMouseEnter={() => setHovered(day)}
              onFocus={() => setHovered(day)}
              onBlur={() => setHovered(null)}
              className={`${CELL} rounded-[3px] outline-none hover:ring-2 hover:ring-slate-300 focus-visible:ring-2 focus-visible:ring-slate-300 ${LEVELS[level(day.reviews + day.learned)]}`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <p data-testid="heatmap-detail" aria-live="polite">
          {hovered ? describe(hovered) : `Active on ${plural(activeDays, 'day')} in the last 12 weeks.`}
        </p>
        <div className="flex items-center gap-1" aria-hidden="true">
          <span>Less</span>
          {LEVELS.map((cls) => (
            <span key={cls} className={`h-3 w-3 rounded-[3px] ${cls}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
