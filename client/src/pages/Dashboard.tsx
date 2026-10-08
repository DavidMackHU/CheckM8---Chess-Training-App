import type { ReactNode } from 'react'
import { Link } from 'react-router'
import CourseProgressRow from '../components/CourseProgressRow.tsx'
import Heatmap from '../components/Heatmap.tsx'
import ProgressRing from '../components/ProgressRing.tsx'
import { ApiError } from '../lib/api.ts'
import { useStats } from '../lib/stats.ts'

const primary = 'rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400'

function Tile({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  return (
    <div data-testid={testId} className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      {children}
    </div>
  )
}

const Big = ({ children }: { children: ReactNode }) => (
  <p className="text-4xl font-semibold tracking-tight text-slate-100">{children}</p>
)

/** Progress dashboard at /dashboard. */
export default function Dashboard() {
  const { data: stats, isPending, error } = useStats()

  if (isPending) return <p className="py-24 text-center text-slate-400">Loading your progress...</p>

  if (error) {
    const needsLogin = error instanceof ApiError && error.status === 401
    return (
      <main className="flex flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">{needsLogin ? 'Log in to see your progress' : 'Could not load your progress'}</h1>
        {!needsLogin && <p className="text-slate-400">{error.message}</p>}
        <Link to={needsLogin ? '/login' : '/'} className="text-emerald-400 underline">
          {needsLogin ? 'Log in' : 'Back to home'}
        </Link>
      </main>
    )
  }

  if (stats.courses.length === 0) {
    return (
      <main className="flex flex-col items-center gap-4 px-4 py-24 text-center" data-testid="dashboard-empty">
        <h1 className="text-2xl font-semibold">Pick your first opening</h1>
        <p className="max-w-md text-slate-400">
          Enroll in a course and learn a few lines. Your reviews, streak and progress will show up here.
        </p>
        <Link to="/openings" className={primary}>
          Browse openings
        </Link>
      </main>
    )
  }

  const nextNewCourse = stats.courses.find((c) => c.new > 0)

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p data-testid="total-xp" className="text-sm text-slate-400">
          <span className="text-lg font-semibold text-slate-100">{stats.xp.toLocaleString()}</span> XP ·{' '}
          <Link to="/leaderboards" className="text-emerald-400 hover:underline">
            Leaderboards
          </Link>
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Lines due now" testId="tile-due">
          <Big>{stats.due}</Big>
          {stats.due > 0 ? (
            <Link to="/train/review" className={`${primary} self-start`}>
              Review now
            </Link>
          ) : (
            <p className="text-sm text-slate-500">All caught up.</p>
          )}
        </Tile>

        <Tile label="New lines available" testId="tile-new">
          <Big>{stats.newAvailable}</Big>
          {stats.newLeftToday > 0 && nextNewCourse ? (
            <Link to={`/train/learn/${nextNewCourse.id}`} className="self-start text-sm text-emerald-400 hover:underline">
              Learn {stats.newLeftToday} today
            </Link>
          ) : (
            <p className="text-sm text-slate-500">
              {stats.newAvailable > 0 ? `Daily limit of ${stats.dailyNewLimit} reached.` : 'Nothing new to learn.'}
            </p>
          )}
        </Tile>

        <Tile label="Mastered" testId="tile-mastered">
          <div className="flex items-center gap-4">
            <ProgressRing percent={stats.masteredPercent} label="Lines mastered" />
            <p className="text-sm text-slate-400">
              <span className="text-slate-200">{stats.mastered}</span> of {stats.totalLines} lines
            </p>
          </div>
        </Tile>

        <Tile label="Current streak" testId="tile-streak">
          <Big>
            {stats.streak} <span className="text-lg font-normal text-slate-400">{stats.streak === 1 ? 'day' : 'days'}</span>
          </Big>
          <p className="text-sm text-slate-500">
            {stats.streak > 0 ? 'Train every day to keep it going.' : 'Train today to start one.'}
          </p>
        </Tile>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Activity, last 12 weeks</h2>
        <div className="w-fit max-w-full rounded-xl border border-slate-800 bg-slate-900 p-4">
          <Heatmap days={stats.heatmap} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Your courses</h2>
          <div className="flex items-center gap-3 text-xs text-slate-400" aria-hidden="true">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full bg-emerald-400" /> Mastered
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full bg-emerald-700" /> Learning
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full bg-slate-800" /> New
            </span>
          </div>
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {stats.courses.map((course) => (
            <CourseProgressRow key={course.id} course={course} />
          ))}
        </ul>
      </section>
    </main>
  )
}
