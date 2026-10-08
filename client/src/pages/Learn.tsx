import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import DrillController from '../components/DrillController.tsx'
import ReviewSummary from '../components/ReviewSummary.tsx'
import { ApiError } from '../lib/api.ts'
import { type DrillResult, type LearnSession, useLearnSession, useMarkLearned } from '../lib/train.ts'

const primary = 'rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400'
const secondary = 'rounded-md border border-slate-700 px-4 py-2 hover:border-slate-500'

function Message({ title, body, to, linkText }: { title: string; body?: string; to: string; linkText: string }) {
  return (
    <main className="flex flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {body && <p className="max-w-md text-slate-400">{body}</p>}
      <Link to={to} className="text-emerald-400 underline">
        {linkText}
      </Link>
    </main>
  )
}

/** Plays through the session's lines one at a time, saving each as it is finished. */
function Session({ session }: { session: LearnSession }) {
  const { course, lines } = session
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<DrillResult | null>(null)
  const markLearned = useMarkLearned()
  const { mutate } = markLearned
  const line = lines[index]

  const onComplete = useCallback(
    (r: DrillResult) => {
      setResult(r)
      mutate(line.id)
    },
    [mutate, line.id],
  )

  const isLast = index === lines.length - 1
  const leftAfterSession = session.newInCourse - lines.length

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">
          <Link to={`/course/${course.slug}`} className="hover:text-emerald-400">
            {course.title}
          </Link>
          <span className="text-slate-500"> · learn</span>
        </h1>
        <p data-testid="session-progress" className="text-sm text-slate-400">
          New line {index + 1} of {lines.length}
        </p>
      </header>

      {result ? (
        <ReviewSummary
          title={isLast ? 'Session complete!' : 'Line learned'}
          lineName={line.name}
          moveCount={line.moves.length}
          result={result}
          analysisFen={line.finalFen}
        >
          {markLearned.data && markLearned.data.xpEarned > 0 && (
            <p data-testid="xp-earned" className="w-full text-sm font-medium text-emerald-400">
              +{markLearned.data.xpEarned} XP
            </p>
          )}
          {markLearned.isError && (
            <p role="alert" className="w-full text-sm text-red-400">
              Could not save this line: {markLearned.error.message}{' '}
              <button type="button" className="underline" onClick={() => mutate(line.id)}>
                Try again
              </button>
            </p>
          )}
          {isLast ? (
            <>
              <Link to={`/course/${course.slug}`} className={primary}>
                Back to the course
              </Link>
              <p className="w-full text-sm text-slate-500">
                {leftAfterSession > 0
                  ? `${leftAfterSession} more new lines are waiting for another day.`
                  : 'You have learned every line in this course.'}
              </p>
            </>
          ) : (
            <button
              type="button"
              className={primary}
              onClick={() => {
                setResult(null)
                setIndex(index + 1)
              }}
            >
              Next line
            </button>
          )}
          <Link to="/openings" className={secondary}>
            All openings
          </Link>
        </ReviewSummary>
      ) : (
        <DrillController
          key={line.id}
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

/** Learn mode at /train/learn/:courseId. Requires an account and enrollment. */
export default function Learn() {
  const { courseId = '' } = useParams()
  const { data, isPending, error } = useLearnSession(courseId)

  if (isPending) return <p className="py-24 text-center text-slate-400">Loading your lines...</p>

  if (error) {
    const status = error instanceof ApiError ? error.status : 0
    if (status === 401) {
      return <Message title="Log in to learn" body="Your progress is saved to your account." to="/login" linkText="Log in" />
    }
    return <Message title="Cannot start learning" body={error.message} to="/openings" linkText="Browse all openings" />
  }

  if (data.lines.length === 0) {
    const finished = data.newInCourse === 0
    return (
      <Message
        title={finished ? 'Course complete' : 'Daily limit reached'}
        body={
          finished
            ? `You have learned all ${data.totalInCourse} lines of ${data.course.title}.`
            : `You have learned ${data.learnedToday} new lines today, which is your daily limit of ${data.dailyNewLimit}. ${data.newInCourse} more are waiting tomorrow.`
        }
        to={`/course/${data.course.slug}`}
        linkText="Back to the course"
      />
    )
  }

  return <Session session={data} />
}
