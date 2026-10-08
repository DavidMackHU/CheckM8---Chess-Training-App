import { currentStreak, dayKey, lastDays } from '../src/srs/activity.js'
import { liveStreak, nextStreak, startOfWeek, XP_REVIEW } from '../src/srs/progress.js'
import { type Grade, gradeDrill, gradeToNumber, isMastered, scheduleLearned, scheduleReview } from '../src/srs/scheduler.js'

const DAY = 24 * 60 * 60 * 1000
const t0 = new Date('2026-10-07T12:00:00Z') // a Wednesday

describe('gradeDrill', () => {
  it('grades any mistake as Again', () => {
    expect(gradeDrill({ mistakes: 1, avgMs: 500, maxMs: 600 })).toBe('AGAIN')
  })
  it('grades a clean run with one slow move as Hard', () => {
    expect(gradeDrill({ mistakes: 0, avgMs: 1500, maxMs: 5001 })).toBe('HARD')
  })
  it('does not count exactly five seconds as slow', () => {
    expect(gradeDrill({ mistakes: 0, avgMs: 3000, maxMs: 5000 })).toBe('GOOD')
  })
  it('grades a clean, fast run as Easy', () => {
    expect(gradeDrill({ mistakes: 0, avgMs: 1999, maxMs: 4000 })).toBe('EASY')
  })
  it('grades a clean run averaging exactly two seconds as Good', () => {
    expect(gradeDrill({ mistakes: 0, avgMs: 2000, maxMs: 4000 })).toBe('GOOD')
  })
  it('stores grades as 1 to 4', () => {
    expect((['AGAIN', 'HARD', 'GOOD', 'EASY'] as Grade[]).map(gradeToNumber)).toEqual([1, 2, 3, 4])
  })
})

describe('scheduling', () => {
  it('makes a learned line due the next day without counting a lapse', () => {
    const card = scheduleLearned({ now: t0, fuzz: false })
    expect(card.due.getTime() - t0.getTime()).toBe(DAY)
    expect(card.lapses).toBe(0)
    expect(card.reps).toBe(1)
  })

  it('grows intervals with good reviews and shrinks them after a miss', () => {
    let card = scheduleLearned({ now: t0, fuzz: false })
    const intervals: number[] = []
    for (const grade of ['GOOD', 'GOOD', 'EASY', 'AGAIN', 'GOOD'] as Grade[]) {
      card = scheduleReview(card, grade, { now: card.due, fuzz: false })
      intervals.push(card.scheduledDays)
    }
    const [first, second, third, afterMiss, recovering] = intervals
    expect(second).toBeGreaterThan(first)
    expect(third).toBeGreaterThan(second)
    expect(afterMiss).toBeLessThan(third)
    expect(recovering).toBeGreaterThan(afterMiss)
    expect(card.lapses).toBe(1)
  })

  it('orders Hard < Good < Easy for the same card', () => {
    const next = (grade: Grade) =>
      scheduleReview(scheduleLearned({ now: t0, fuzz: false }), grade, { now: new Date(t0.getTime() + DAY), fuzz: false })
        .scheduledDays
    expect(next('HARD')).toBeLessThan(next('GOOD'))
    expect(next('GOOD')).toBeLessThan(next('EASY'))
  })

  it('sets the due date to the review time plus the interval', () => {
    const learned = scheduleLearned({ now: t0, fuzz: false })
    const card = scheduleReview(learned, 'GOOD', { now: learned.due, fuzz: false })
    expect(Math.round((card.due.getTime() - learned.due.getTime()) / DAY)).toBe(card.scheduledDays)
  })

  it('treats three weeks of stability as mastered', () => {
    expect(isMastered({ stability: 20.9 })).toBe(false)
    expect(isMastered({ stability: 21 })).toBe(true)
  })
})

describe('days and streaks', () => {
  it('lists the last N days ending today', () => {
    const days = lastDays(84, t0)
    expect(days).toHaveLength(84)
    expect(days[83]).toBe('2026-10-07')
    expect(days[0]).toBe('2026-07-16')
    expect(dayKey(t0)).toBe('2026-10-07')
  })

  it.each([
    [[], 0],
    [['2026-10-07'], 1],
    [['2026-10-06'], 1], // yesterday only: not broken yet
    [['2026-10-05'], 0],
    [['2026-10-05', '2026-10-06', '2026-10-07'], 3],
    [['2026-10-03', '2026-10-04', '2026-10-06', '2026-10-07'], 2], // a gap breaks it
  ])('computes the current streak from active days %j', (days, expected) => {
    expect(currentStreak(new Set(days), t0)).toBe(expected)
  })

  it('counts a streak across a month boundary', () => {
    expect(currentStreak(new Set(['2026-09-29', '2026-09-30', '2026-10-01']), new Date('2026-10-01T01:00:00Z'))).toBe(3)
  })

  it('advances the stored streak once per day', () => {
    expect(nextStreak(0, null, t0)).toBe(1)
    expect(nextStreak(3, new Date('2026-10-07T01:00:00Z'), t0)).toBe(3)
    expect(nextStreak(3, new Date('2026-10-06T23:59:00Z'), t0)).toBe(4)
    expect(nextStreak(9, new Date('2026-10-05T12:00:00Z'), t0)).toBe(1)
  })

  it('shows a stored streak only while it is still alive', () => {
    expect(liveStreak(4, new Date('2026-10-07T01:00:00Z'), t0)).toBe(4)
    expect(liveStreak(4, new Date('2026-10-06T01:00:00Z'), t0)).toBe(4)
    expect(liveStreak(4, new Date('2026-10-05T23:00:00Z'), t0)).toBe(0)
    expect(liveStreak(4, null, t0)).toBe(0)
  })

  it('starts the leaderboard week on Monday at midnight UTC', () => {
    expect(startOfWeek(t0).toISOString()).toBe('2026-10-05T00:00:00.000Z')
    expect(startOfWeek(new Date('2026-10-11T23:00:00Z')).toISOString()).toBe('2026-10-05T00:00:00.000Z')
    expect(startOfWeek(new Date('2026-10-12T00:00:01Z')).toISOString()).toBe('2026-10-12T00:00:00.000Z')
  })

  it('pays more XP for better grades', () => {
    expect(XP_REVIEW.AGAIN).toBeLessThan(XP_REVIEW.HARD)
    expect(XP_REVIEW.HARD).toBeLessThan(XP_REVIEW.GOOD)
    expect(XP_REVIEW.GOOD).toBeLessThan(XP_REVIEW.EASY)
  })
})
