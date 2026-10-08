import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import HumanDrill, { type HumanResult } from '../components/HumanDrill.tsx'
import { ApiError } from '../lib/api.ts'
import { formatMoves } from '../lib/courses.ts'
import { RATING_LABEL, type RatingBucket, useHumanCourse } from '../lib/human.ts'

const primary = 'rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400'
const secondary = 'rounded-md border border-slate-700 px-4 py-2 hover:border-slate-500'
const field = 'rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-emerald-400'
const BUCKET_KEY = 'od.humanBucket'
const BUCKETS = Object.keys(RATING_LABEL) as RatingBucket[]

function savedBucket(): RatingBucket {
  try {
    const value = localStorage.getItem(BUCKET_KEY)
    if (value && (BUCKETS as string[]).includes(value)) return value as RatingBucket
  } catch {
    // Storage unavailable: use the default.
  }
  return 'club'
}

/** Human moves mode at /train/human/:courseId. */
export default function HumanMoves() {
  const { courseId = '' } = useParams()
  const { data, isPending, error } = useHumanCourse(courseId)
  const [bucket, setBucket] = useState<RatingBucket>(savedBucket)
  const [mayLeavePrep, setMayLeavePrep] = useState(false)
  const [game, setGame] = useState(0)
  const [result, setResult] = useState<HumanResult | null>(null)
  const onFinish = useCallback((r: HumanResult) => setResult(r), [])

  if (isPending) return <p className="py-24 text-center text-slate-400">Loading course...</p>
  if (error) {
    const needsLogin = error instanceof ApiError && error.status === 401
    return (
      <main className="flex flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">{needsLogin ? 'Log in to play Human moves' : 'Cannot open this course'}</h1>
        {!needsLogin && <p className="text-slate-400">{error.message}</p>}
        <Link to={needsLogin ? '/login' : '/openings'} className="text-emerald-400 underline">
          {needsLogin ? 'Log in' : 'Browse openings'}
        </Link>
      </main>
    )
  }

  const { course, lines } = data
  const restart = () => {
    setResult(null)
    setGame((g) => g + 1)
  }
  const changeBucket = (next: RatingBucket) => {
    setBucket(next)
    try {
      localStorage.setItem(BUCKET_KEY, next)
    } catch {
      // Not saved; fine.
    }
    restart()
  }

  if (lines.length === 0) {
    return (
      <main className="flex flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">This course has no lines yet</h1>
        <Link to={`/course/${course.slug}`} className="text-emerald-400 underline">
          Back to the course
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">
          <Link to={`/course/${course.slug}`} className="hover:text-emerald-400">
            {course.title}
          </Link>
          <span className="text-slate-500"> · human moves</span>
        </h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-300">
          <label className="flex items-center gap-2">
            Opponent level
            <select value={bucket} onChange={(e) => changeBucket(e.target.value as RatingBucket)} className={field}>
              {BUCKETS.map((b) => (
                <option key={b} value={b}>
                  {RATING_LABEL[b]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mayLeavePrep}
              onChange={(e) => {
                setMayLeavePrep(e.target.checked)
                restart()
              }}
              className="h-4 w-4 accent-emerald-500"
            />
            Opponent may leave my prep
          </label>
        </div>
        <p className="text-sm text-slate-500">
          The opponent picks its replies the way real players at this level do. Nothing here affects your review schedule.
        </p>
      </header>

      <HumanDrill
        key={`${game}-${bucket}-${mayLeavePrep}`}
        lines={lines}
        side={course.side}
        startFen={course.startFen}
        bucket={bucket}
        mayLeavePrep={mayLeavePrep}
        onFinish={onFinish}
      />

      {result && (
        <section
          data-testid="human-summary"
          className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center"
        >
          <h2 className="text-xl font-bold">{result.outcome === 'left' ? 'Opponent left your prep.' : 'End of your prep.'}</h2>
          <p className="text-sm text-slate-400">
            {result.outcome === 'left'
              ? 'That reply is not covered by this course. From here you are on your own.'
              : (result.lineName ?? 'You reached the end of a line.')}
          </p>
          <p className="font-mono text-sm break-words text-slate-300">{formatMoves(result.moves)}</p>
          <p className="text-sm text-slate-400">
            {result.mistakes === 0 ? 'No mistakes.' : `${result.mistakes} ${result.mistakes === 1 ? 'mistake' : 'mistakes'}.`}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={restart} className={primary}>
              Play again
            </button>
            <Link to={`/analysis?fen=${encodeURIComponent(result.finalFen)}`} className={secondary}>
              Open in analysis
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}
