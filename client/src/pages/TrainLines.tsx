import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import DrillController from '../components/DrillController.tsx'
import ReviewSummary from '../components/ReviewSummary.tsx'
import { ApiError, apiGet } from '../lib/api.ts'
import { type DrillCourse, type DrillLine, type DrillResult, useMarkLearned, useSubmitResult } from '../lib/train.ts'

type ChosenSession = { course: DrillCourse; lines: DrillLine[]; learned: string[] }

const primary = 'rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400'
const secondary = 'rounded-md border border-slate-700 px-4 py-2 hover:border-slate-500'

/**
 * Trains the lines a player picked on the course page, in course order.
 * Lines they have not learned yet are taught (hints free, like learn mode);
 * lines they know are reviewed from memory and rescheduled.
 */
function Session({ session }: { session: ChosenSession }) {
  const { course, lines } = session
  const [learned] = useState(() => new Set(session.learned))
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<DrillResult | null>(null)
  const markLearned = useMarkLearned()
  const submit = useSubmitResult()
  const line = lines[index]
  const isReview = learned.has(line.id)
  const isLast = index === lines.length - 1

  const onComplete = useCallback(
    (r: DrillResult) => {
      setResult(r)
      if (isReview) submit.mutate({ lineId: line.id, mistakes: r.mistakes, avgMs: r.avgMs, maxMs: r.maxMs })
      else markLearned.mutate(line.id)
    },
    // The mutate functions are stable; only the line and its mode matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isReview, line.id],
  )

  const saved = isReview ? submit : markLearned
  const xp = isReview ? submit.data?.xpEarned : markLearned.data?.xpEarned

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">
          <Link to={`/course/${course.slug}`} className="hover:text-emerald-400">
            {course.title}
          </Link>
          <span className="text-slate-500"> · {isReview ? 'review' : 'learn'}</span>
        </h1>
        <p data-testid="session-progress" className="text-sm text-slate-400">
          Line {index + 1} of {lines.length}
        </p>
      </header>

      {result ? (
        <ReviewSummary
          title={isLast ? 'Session complete!' : isReview ? 'Line reviewed' : 'Line learned'}
          lineName={line.name}
          moveCount={line.moves.length}
          result={result}
          analysisFen={line.finalFen}
        >
          {!!xp && xp > 0 && (
            <p data-testid="xp-earned" className="w-full text-sm font-medium text-emerald-400">
              +{xp} XP
            </p>
          )}
          {saved.isError && (
            <p role="alert" className="w-full text-sm text-red-400">
              Could not save this line: {saved.error.message}
            </p>
          )}
          {isLast ? (
            <Link to={`/course/${course.slug}`} className={primary}>
              Back to the course
            </Link>
          ) : (
            <button
              type="button"
              className={primary}
              onClick={() => {
                setResult(null)
                submit.reset()
                markLearned.reset()
                setIndex(index + 1)
              }}
            >
              Next line
            </button>
          )}
          {!isLast && (
            <Link to={`/course/${course.slug}`} className={secondary}>
              Stop here
            </Link>
          )}
        </ReviewSummary>
      ) : (
        <DrillController
          key={line.id}
          line={line}
          side={course.side}
          startFen={course.startFen}
          mode={isReview ? 'review' : 'learn'}
          onComplete={onComplete}
        />
      )}
    </main>
  )
}

/** /train/lines/:courseId?ids=a,b,c  (reached from "Train selected" on a course page). */
export default function TrainLines() {
  const { courseId = '' } = useParams()
  const ids = useSearchParams()[0].get('ids') ?? ''
  const { data, isPending, error } = useQuery({
    queryKey: ['chosen-lines', courseId, ids],
    queryFn: () => apiGet<ChosenSession>(`/train/lines/${encodeURIComponent(courseId)}?ids=${encodeURIComponent(ids)}`),
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })

  if (isPending) return <p className="py-24 text-center text-slate-400">Loading your lines...</p>
  if (error || data.lines.length === 0) {
    const needsLogin = error instanceof ApiError && error.status === 401
    return (
      <main className="flex flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">{needsLogin ? 'Log in to train' : 'Cannot start this session'}</h1>
        <p className="max-w-md text-slate-400">{error ? error.message : 'None of the chosen lines were found.'}</p>
        <Link to={needsLogin ? '/login' : '/openings'} className="text-emerald-400 underline">
          {needsLogin ? 'Log in' : 'Browse all openings'}
        </Link>
      </main>
    )
  }
  return <Session session={data} />
}
