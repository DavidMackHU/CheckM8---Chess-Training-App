import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { SideBadge } from '../components/CourseCard.tsx'
import { ApiError } from '../lib/api.ts'
import { useCreateCourse, useMyCourses } from '../lib/creator.ts'
import type { Side } from '../lib/courses.ts'

const field =
  'rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400'

/** /creator/new: start a course (optionally from a PGN), and see the courses you already made. */
export default function CreatorNew() {
  const navigate = useNavigate()
  const create = useCreateCourse()
  const mine = useMyCourses()
  const [title, setTitle] = useState('')
  const [side, setSide] = useState<Side>('WHITE')
  const [pgn, setPgn] = useState('')

  if (mine.error instanceof ApiError && mine.error.status === 401) {
    return (
      <main className="flex flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Log in to create a course</h1>
        <Link to="/login" className="text-emerald-400 underline">
          Log in
        </Link>
      </main>
    )
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    create.mutate(
      { title, side, pgn: pgn.trim() || undefined },
      { onSuccess: ({ course }) => navigate(`/creator/${course.id}`) },
    )
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Create a course</h1>
        <p className="text-slate-400">
          Build your own repertoire. Your course is private until you choose to publish it.
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Title
            <input
              name="title"
              required
              minLength={3}
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Sicilian repertoire"
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            You play
            <select name="side" value={side} onChange={(e) => setSide(e.target.value as Side)} className={field}>
              <option value="WHITE">White</option>
              <option value="BLACK">Black</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            PGN (optional)
            <textarea
              name="pgn"
              rows={6}
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
              placeholder="Paste a PGN with variations, or leave empty and add moves on the board."
              className={`${field} font-mono text-sm`}
            />
          </label>

          {create.isError && (
            <p role="alert" className="text-sm text-red-400">
              {create.error.message}
            </p>
          )}

          <button
            type="submit"
            disabled={create.isPending}
            className="self-start rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {create.isPending ? 'Creating...' : 'Create course'}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Your courses</h2>
        {mine.isPending && <p className="text-slate-400">Loading...</p>}
        {mine.data && mine.data.length === 0 && <p className="text-slate-400">You have not created any courses yet.</p>}
        {mine.data && mine.data.length > 0 && (
          <ul data-testid="my-courses" className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {mine.data.map((course) => (
              <li key={course.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <Link to={`/creator/${course.id}`} className="font-medium hover:text-emerald-400">
                    {course.title}
                  </Link>
                  <SideBadge side={course.side} />
                  <span className="text-sm text-slate-400">
                    {course.lineCount} {course.lineCount === 1 ? 'line' : 'lines'} · {course.isPublic ? 'Published' : 'Private'}
                  </span>
                </div>
                <Link to={`/creator/${course.id}`} className="text-sm text-emerald-400 hover:underline">
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
