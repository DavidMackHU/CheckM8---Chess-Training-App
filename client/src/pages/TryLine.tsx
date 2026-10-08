import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import DrillController from '../components/DrillController.tsx'
import ReviewSummary from '../components/ReviewSummary.tsx'
import { useCurrentUser } from '../lib/auth.ts'
import { type DrillResult, useFirstLine } from '../lib/train.ts'

const primary = 'rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400'
const secondary = 'rounded-md border border-slate-700 px-4 py-2 hover:border-slate-500'

/** Guest preview at /course/:slug/try: anyone can play line 1 of a course. Nothing is saved. */
export default function TryLine() {
  const { slug = '' } = useParams()
  const { data, isPending, error } = useFirstLine(slug)
  const { data: user } = useCurrentUser()
  const [result, setResult] = useState<DrillResult | null>(null)
  const [attempt, setAttempt] = useState(0)
  const onComplete = useCallback((r: DrillResult) => setResult(r), [])

  if (isPending) return <p className="py-24 text-center text-slate-400">Loading line...</p>
  if (error) {
    return (
      <main className="flex flex-col items-center gap-4 py-24">
        <h1 className="text-2xl font-semibold">Could not load this line</h1>
        <p className="text-slate-400">{error.message}</p>
        <Link to="/openings" className="text-emerald-400 underline">
          Browse all openings
        </Link>
      </main>
    )
  }

  const { course, line } = data
  const retry = () => {
    setResult(null)
    setAttempt((a) => a + 1)
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">
          <Link to={`/course/${course.slug}`} className="hover:text-emerald-400">
            {course.title}
          </Link>
          <span className="text-slate-500"> · first line</span>
        </h1>
        <p className="text-sm text-slate-400">Follow the arrows. Play each move on the board.</p>
      </header>

      {result ? (
        <ReviewSummary title="First line done!" lineName={line.name} moveCount={line.moves.length} result={result} analysisFen={line.finalFen}>
          {user ? (
            <Link to={`/course/${course.slug}`} className={primary}>
              Back to the course
            </Link>
          ) : (
            <Link to="/signup" data-testid="signup-prompt" className={primary}>
              Sign up to save your progress
            </Link>
          )}
          <button type="button" onClick={retry} className={secondary}>
            Play it again
          </button>
        </ReviewSummary>
      ) : (
        <DrillController
          key={`${line.id}-${attempt}`}
          line={line}
          side={course.side}
          startFen={course.startFen}
          mode="learn"
          onComplete={onComplete}
        />
      )}
    </main>
  )
}
