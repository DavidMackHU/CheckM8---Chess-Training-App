import { Link } from 'react-router'
import CourseCatalog from '../components/CourseCatalog.tsx'
import { useCurrentUser } from '../lib/auth.ts'

/** Landing page: short pitch, then the course catalog. */
export default function Home() {
  const { data: user } = useCurrentUser()

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-12">
      <header className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Stop forgetting your openings.</h1>
        <p className="text-lg text-slate-400">
          Pick an opening, learn it one line at a time, and review it on a schedule that makes the moves stick.
        </p>
        {user ? (
          <p data-testid="welcome" className="text-emerald-400">
            Welcome back, {user.username}.
          </p>
        ) : (
          <Link
            to="/signup"
            className="rounded-md bg-emerald-500 px-5 py-2.5 font-medium text-slate-950 hover:bg-emerald-400"
          >
            Create a free account
          </Link>
        )}
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Openings</h2>
        <CourseCatalog />
      </section>
    </main>
  )
}
