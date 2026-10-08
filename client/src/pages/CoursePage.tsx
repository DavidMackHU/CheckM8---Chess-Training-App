import { Link, useParams } from 'react-router'
import BoardThumbnail from '../components/BoardThumbnail.tsx'
import { SideBadge } from '../components/CourseCard.tsx'
import { ApiError } from '../lib/api.ts'
import { useCurrentUser } from '../lib/auth.ts'
import { type CourseDetail, DIFFICULTY_LABEL, formatMoves, useCourse, useEnroll, useUpvote } from '../lib/courses.ts'

function EnrollButton({ course }: { course: CourseDetail }) {
  const { data: user } = useCurrentUser()
  const enroll = useEnroll(course)

  if (course.enrolled) {
    return (
      <span data-testid="enrolled" className="rounded-md border border-emerald-500/50 px-4 py-2 text-emerald-400">
        Enrolled
      </span>
    )
  }
  if (!user) {
    return (
      <Link to="/signup" className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400">
        Sign up to enroll
      </Link>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => enroll.mutate()}
        disabled={enroll.isPending}
        className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {enroll.isPending ? 'Enrolling...' : 'Enroll'}
      </button>
      {enroll.isError && (
        <span role="alert" className="text-sm text-red-400">
          {enroll.error.message}
        </span>
      )}
    </div>
  )
}

/** Upvotes are for other people's public community courses. */
function UpvoteButton({ course }: { course: CourseDetail }) {
  const { data: user } = useCurrentUser()
  const upvote = useUpvote(course)
  const label = `${course.upvotes} ${course.upvotes === 1 ? 'upvote' : 'upvotes'}`

  if (course.isOfficial || !course.isPublic) return null
  if (!user || course.isOwner) {
    return (
      <span data-testid="upvote-count" className="px-1 py-2 text-sm text-slate-400">
        {label}
      </span>
    )
  }
  return (
    <button
      type="button"
      data-testid="upvote-button"
      aria-pressed={course.upvoted}
      onClick={() => upvote.mutate(!course.upvoted)}
      disabled={upvote.isPending}
      className={`rounded-md border px-4 py-2 text-sm ${
        course.upvoted ? 'border-emerald-500 text-emerald-400' : 'border-slate-700 hover:border-slate-500'
      }`}
    >
      {course.upvoted ? 'Upvoted' : 'Upvote'} · {label}
    </button>
  )
}

export default function CoursePage() {
  const { slug = '' } = useParams()
  const { data, isPending, error } = useCourse(slug)
  const { data: user } = useCurrentUser()

  if (isPending) return <p className="py-24 text-center text-slate-400">Loading course...</p>

  if (error) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <main className="flex flex-col items-center gap-4 py-24">
        <h1 className="text-2xl font-semibold">{notFound ? 'Course not found' : 'Could not load this course'}</h1>
        {!notFound && <p className="text-slate-400">{error.message}</p>}
        <Link to="/openings" className="text-emerald-400 underline">
          Browse all openings
        </Link>
      </main>
    )
  }

  const { course, lines } = data
  const keyPly = course.keyMoves.length

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10">
      <header className="grid gap-6 sm:grid-cols-[16rem_1fr]">
        <div className="mx-auto w-full max-w-64">
          <BoardThumbnail fen={course.keyFen} orientation={course.side === 'WHITE' ? 'white' : 'black'} />
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
          <p className="font-mono text-sm text-slate-400">{formatMoves(course.keyMoves)}</p>
          {course.pitch && <p className="text-lg text-slate-200">{course.pitch}</p>}
          {course.description && <p className="text-slate-400">{course.description}</p>}
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <SideBadge side={course.side} />
            <span>{course.lineCount} lines</span>
            <span>{DIFFICULTY_LABEL[course.difficulty]}</span>
            <span>by {course.author}</span>
            {!course.isPublic && (
              <span data-testid="private-badge" className="rounded-full border border-amber-500/50 px-2 py-0.5 text-xs text-amber-300">
                Private
              </span>
            )}
            {course.isOwner && (
              <Link to={`/creator/${course.id}`} className="text-emerald-400 hover:underline">
                Edit course
              </Link>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-start gap-3">
            {course.enrolled && (
              <Link
                to={`/train/learn/${course.id}`}
                className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400"
              >
                Learn new lines
              </Link>
            )}
            <EnrollButton course={course} />
            <Link
              to={`/course/${course.slug}/try`}
              className="rounded-md border border-slate-700 px-4 py-2 hover:border-slate-500"
            >
              Try the first line
            </Link>
            {user && course.lineCount > 0 && (
              <Link
                to={`/train/human/${course.id}`}
                className="rounded-md border border-slate-700 px-4 py-2 hover:border-slate-500"
              >
                Play vs human moves
              </Link>
            )}
            <UpvoteButton course={course} />
          </div>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Lines</h2>
        <ol data-testid="line-list" className="divide-y divide-slate-800 rounded-xl border border-slate-800">
          {lines.map((line) => (
            <li key={line.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="w-8 shrink-0 text-sm text-slate-500">{line.order}.</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{line.name}</p>
                <p className="font-mono text-sm break-words text-slate-400">
                  <span className="text-slate-600">{formatMoves(line.moves.slice(0, keyPly))}</span>{' '}
                  {formatMoves(line.moves).slice(formatMoves(line.moves.slice(0, keyPly)).length).trim()}
                </p>
              </div>
              <Link
                to={`/analysis?fen=${encodeURIComponent(line.finalFen)}`}
                className="shrink-0 text-sm text-emerald-400 hover:underline"
              >
                View position
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
