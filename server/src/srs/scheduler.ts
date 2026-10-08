import { type Card as FsrsCard, createEmptyCard, fsrs, generatorParameters, Rating, type State } from 'ts-fsrs'

/**
 * Spaced repetition for lines, using FSRS (the algorithm family Anki uses).
 * One card per user per line. This file is the only place that talks to ts-fsrs.
 */

/** The scheduling fields stored on a Card row. */
export type CardSchedule = {
  due: Date
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: number
  lastReview: Date | null
}

export type Grade = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'
type FsrsGrade = Rating.Again | Rating.Hard | Rating.Good | Rating.Easy

const TO_RATING: Record<Grade, FsrsGrade> = {
  AGAIN: Rating.Again,
  HARD: Rating.Hard,
  GOOD: Rating.Good,
  EASY: Rating.Easy,
}

/** Stored in ReviewLog.rating: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy. */
export const gradeToNumber = (grade: Grade): number => TO_RATING[grade]

// A clean line is "slow" if any single move took longer than this...
const SLOW_MOVE_MS = 5000
// ...and "fast" if the average move took less than this.
const FAST_AVG_MS = 2000

export type DrillStats = { mistakes: number; avgMs: number; maxMs: number }

/**
 * Turns how a review went into a grade:
 *   any wrong move            -> Again
 *   clean, but one slow move  -> Hard
 *   clean and fast on average -> Easy
 *   clean                     -> Good
 */
export function gradeDrill({ mistakes, avgMs, maxMs }: DrillStats): Grade {
  if (mistakes > 0) return 'AGAIN'
  if (maxMs > SLOW_MOVE_MS) return 'HARD'
  if (avgMs < FAST_AVG_MS) return 'EASY'
  return 'GOOD'
}

// Lines are reviewed in whole days, so the same-day "learning steps" are off.
// Fuzz spreads due dates slightly so lines learned together do not all return on one day.
function scheduler(fuzz: boolean) {
  return fsrs(generatorParameters({ enable_short_term: false, enable_fuzz: fuzz }))
}

function toFsrs(card: CardSchedule): FsrsCard {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    last_review: card.lastReview ?? undefined,
  }
}

function fromFsrs(card: FsrsCard): CardSchedule {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ?? null,
  }
}

type Options = { now?: Date; fuzz?: boolean }

/**
 * Schedule for a line that was just learned with hints. Seeing the answer is
 * not recalling it, so the first real test comes the next day.
 */
export function scheduleLearned({ now = new Date(), fuzz = true }: Options = {}): CardSchedule {
  return fromFsrs(scheduler(fuzz).next(createEmptyCard(now), now, Rating.Again).card)
}

/** Schedule after a review. Pass the card as stored and the grade it earned. */
export function scheduleReview(card: CardSchedule, grade: Grade, { now = new Date(), fuzz = true }: Options = {}): CardSchedule {
  return fromFsrs(scheduler(fuzz).next(toFsrs(card), now, TO_RATING[grade]).card)
}

/** A line counts as mastered once FSRS expects it to be remembered for three weeks or more. */
export const MASTERED_STABILITY_DAYS = 21
export const isMastered = (card: Pick<CardSchedule, 'stability'>): boolean => card.stability >= MASTERED_STABILITY_DAYS
