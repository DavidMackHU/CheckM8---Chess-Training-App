import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import DrillController from '../components/DrillController.tsx'
import ReviewSummary from '../components/ReviewSummary.tsx'
import { ApiError } from '../lib/api.ts'
import {
  type DrillResult,
  type Grade,
  type ReviewOutcome,
  type ReviewQueue,
  useReviewQueue,
  useSubmitResult,
} from '../lib/train.ts'

const primary = 'rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400'
const secondary = 'rounded-md border border-slate-700 px-4 py-2 hover:border-slate-500'

const GRADE_LABEL: Record<Grade, string> = { AGAIN: 'Again', HARD: 'Hard', GOOD: 'Good', EASY: 'Easy' }
const GRADE_COLOR: Record<Grade, string> = {
  AGAIN: 'text-red-400',
  HARD: 'text-amber-400',
  GOOD: 'text-emerald-400',
  EASY: 'text-sky-400',
}

function nextReviewText(outcome: ReviewOutcome): string {
  const days = outcome.scheduledDays
  return days <= 1 ? 'Next review tomorrow.' : `Next review in ${days} days.`
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="max-w-md text-slate-400">{body}</p>
      <Link to="/openings" className="text-emerald-400 underline">
        Browse openings
      </Link>
    </main>
  )
}

/** Works through the due lines one at a time, grading and rescheduling each. */
function Session({ queue }: { queue: ReviewQueue }) {
  const { items } = queue
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<DrillResult | null>(null)
  const [cleanCount, setCleanCount] = useState(0)
  const submit = useSubmitResult()
  const { mutate, reset } = submit
  const { line, course } = items[index]

  const send = useCallback(
    (r: DrillResult) => mutate({ lineId: line.id, mistakes: r.mistakes, avgMs: r.avgMs, maxMs: r.maxMs }),
    [mutate, line.id],
  )
  const onComplete = useCallback(
    (r: DrillResult) => {
      setResult(r)
      if (r.mistakes === 0) setCleanCount((c) => c + 1)
      send(r)
    },
    [send],
  )

  const isLast = index === items.length - 1
  const stillDue = queue.dueCount - items.length
  const outcome = submit.data

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">
          Review <span className="text-slate-500">· {course.title}</span>
        </h1>
        <p data-testid="session-progress" className="text-sm text-slate-400">
          Line {index + 1} of {items.length}
        </p>
      </header>

      {result ? (
        <ReviewSummary
          title={isLast ? 'Review complete!' : result.mistakes === 0 ? 'Remembered' : 'Needs another look'}
          lineName={line.name}
          moveCount={line.moves.length}
          result={result}
          analysisFen={line.finalFen}
        >
          <div className="w-full text-sm" aria-live="polite">
            {submit.isPending && <p className="text-slate-400">Saving...</p>}
            {outcome && (
              <p data-testid="review-outcome">
                Grade: <span className={`font-semibold ${GRADE_COLOR[outcome.grade]}`}>{GRADE_LABEL[outcome.grade]}</span>.{' '}
                {nextReviewText(outcome)}{' '}
                <span data-testid="xp-earned" className="font-medium text-emerald-400">
                  +{outcome.xpEarned} XP
                </span>
              </p>
            )}
            {submit.isError && (
              <p role="alert" className="text-red-400">
                Could not save this review: {submit.error.message}{' '}
                <button type="button" className="underline" onClick={() => send(result)}>
                  Try again
                </button>
              </p>
            )}
            {isLast && (
              <p data-testid="session-total" className="mt-2 text-slate-400">
                {cleanCount} of {items.length} lines from memory.
                {stillDue > 0 && ` ${stillDue} more are due. Reload to continue.`}
              </p>
            )}
          </div>
          {isLast ? (
            <Link to="/dashboard" className={primary}>
              Done
            </Link>
          ) : (
            <button
              type="button"
              className={primary}
              onClick={() => {
                setResult(null)
                reset()
                setIndex(index + 1)
              }}
            >
              Next line
            </button>
          )}
          <Link to={`/course/${course.slug}`} className={secondary}>
            Open course
          </Link>
        </ReviewSummary>
      ) : (
        <DrillController
          key={line.id}
          line={line}
          side={course.side}
          startFen={course.startFen}
          mode="review"
          onComplete={onComplete}
        />
      )}
    </main>
  )
}

/** Review mode at /train/review: every due line, from memory, no hints. */
export default function Review() {
  const { data, isPending, error } = useReviewQueue()

  if (isPending) return <p className="py-24 text-center text-slate-400">Loading your reviews...</p>

  if (error) {
    if (error instanceof ApiError && error.status === 401) {
      return (
        <main className="flex flex-col items-center gap-4 px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold">Log in to review</h1>
          <Link to="/login" className="text-emerald-400 underline">
            Log in
          </Link>
        </main>
      )
    }
    return <Message title="Could not load your reviews" body={error.message} />
  }

  if (data.items.length === 0) {
    return (
      <Message
        title="Nothing due right now"
        body="Lines come back for review on their own schedule. Learn some new lines in the meantime."
      />
    )
  }

  return <Session queue={data} />
}
