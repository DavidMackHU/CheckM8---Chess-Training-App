import { useState } from 'react'
import { Link } from 'react-router'
import LeaderboardTable from '../components/LeaderboardTable.tsx'
import { useCurrentUser } from '../lib/auth.ts'
import { type LeaderboardPeriod, useLeaderboard } from '../lib/leaderboards.ts'

const TABS: { period: LeaderboardPeriod; label: string }[] = [
  { period: 'week', label: 'This week' },
  { period: 'all', label: 'All time' },
]

/** Leaderboards at /leaderboards: XP this week (resets Monday, UTC) and all time. */
export default function Leaderboards() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('week')
  const { data, isPending, error } = useLeaderboard(period)
  const { data: user } = useCurrentUser()

  const meOffBoard = data?.me && !data.entries.some((e) => e.username === data.me?.username) ? data.me : null

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leaderboards</h1>
          <p className="mt-1 text-sm text-slate-400">
            {period === 'week' ? 'XP earned since Monday. Resets every week.' : 'Total XP earned since joining.'}
          </p>
        </div>
        <div role="tablist" aria-label="Period" className="flex rounded-lg border border-slate-800 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.period}
              type="button"
              role="tab"
              aria-selected={period === tab.period}
              onClick={() => setPeriod(tab.period)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                period === tab.period ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {isPending && <p className="py-12 text-center text-slate-400">Loading rankings...</p>}

      {error && (
        <p role="alert" className="py-12 text-center text-red-400">
          Could not load the leaderboard. {error.message}
        </p>
      )}

      {data && data.entries.length === 0 && (
        <p data-testid="leaderboard-empty" className="py-12 text-center text-slate-400">
          {period === 'week' ? 'Nobody has earned XP this week yet. Be the first.' : 'Nobody has earned XP yet.'}
        </p>
      )}

      {data && data.entries.length > 0 && <LeaderboardTable entries={data.entries} highlight={user?.username} />}

      {meOffBoard && (
        <p data-testid="my-rank" className="text-center text-sm text-slate-400">
          You are ranked {meOffBoard.rank} with {meOffBoard.xp.toLocaleString()} XP.
        </p>
      )}

      {data && user && !data.me && (
        <p data-testid="no-xp" className="text-center text-sm text-slate-400">
          {period === 'week' ? 'You have no XP this week yet. ' : 'You have no XP yet. '}
          <Link to="/dashboard" className="text-emerald-400 underline">
            Train to get on the board
          </Link>
        </p>
      )}

      {data && !user && (
        <p className="text-center text-sm text-slate-400">
          <Link to="/signup" className="text-emerald-400 underline">
            Create an account
          </Link>{' '}
          to earn XP and join the rankings.
        </p>
      )}
    </main>
  )
}
