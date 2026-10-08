import { Link } from 'react-router'
import { useCurrentUser, useLogout } from '../lib/auth.ts'

export default function Navbar() {
  const { data: user, isPending } = useCurrentUser()
  const logout = useLogout()

  return (
    <header className="border-b border-slate-800">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link to="/" className="text-lg font-bold tracking-tight">
          OpeningDrill
        </Link>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link to="/openings" className="text-slate-300 hover:text-white">
            Openings
          </Link>
          <Link to="/community" className="text-slate-300 hover:text-white">
            Community
          </Link>
          <Link to="/analysis" className="text-slate-300 hover:text-white">
            Analysis
          </Link>
          <Link to="/leaderboards" className="text-slate-300 hover:text-white">
            Leaderboards
          </Link>
          {isPending ? null : user ? (
            <>
              <Link to="/dashboard" className="text-slate-300 hover:text-white">
                Dashboard
              </Link>
              <Link to="/train/review" className="text-slate-300 hover:text-white">
                Review
              </Link>
              <Link to="/creator/new" className="text-slate-300 hover:text-white">
                Create
              </Link>
              <span data-testid="nav-username" className="max-w-32 truncate text-slate-300">
                {user.username}
              </span>
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="rounded-md border border-slate-700 px-3 py-1.5 hover:border-slate-500"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-slate-300 hover:text-white">
                Log in
              </Link>
              <Link
                to="/signup"
                className="rounded-md bg-emerald-500 px-3 py-1.5 font-medium text-slate-950 hover:bg-emerald-400"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
