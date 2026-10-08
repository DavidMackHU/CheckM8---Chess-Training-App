import type { LeaderboardEntry } from '../lib/leaderboards.ts'

type Props = {
  entries: LeaderboardEntry[]
  /** Username of the signed-in user, so their row can be highlighted. */
  highlight?: string
}

export default function LeaderboardTable({ entries, highlight }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <table className="w-full text-left text-sm" data-testid="leaderboard">
        <thead className="bg-slate-900 text-xs tracking-wide text-slate-400 uppercase">
          <tr>
            <th scope="col" className="w-14 px-4 py-3">
              Rank
            </th>
            <th scope="col" className="px-4 py-3">
              Player
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Streak
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              XP
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {entries.map((entry) => {
            const isMe = entry.username === highlight
            return (
              <tr key={entry.username} data-me={isMe || undefined} className={isMe ? 'bg-emerald-500/10' : undefined}>
                <td className="px-4 py-3 text-slate-400 tabular-nums">{entry.rank}</td>
                <td className="max-w-0 truncate px-4 py-3 font-medium">
                  {entry.username}
                  {isMe && <span className="ml-2 text-xs font-normal text-emerald-400">you</span>}
                </td>
                <td className="px-4 py-3 text-right text-slate-400 tabular-nums">
                  {entry.streak > 0 ? `${entry.streak} ${entry.streak === 1 ? 'day' : 'days'}` : '-'}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{entry.xp.toLocaleString()}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
