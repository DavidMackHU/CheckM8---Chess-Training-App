import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import MoveTreeEditor from '../components/MoveTreeEditor.tsx'
import PgnImporter from '../components/PgnImporter.tsx'
import {
  type EditableCourse,
  useDeleteCourse,
  useEditableCourse,
  usePublishCourse,
  useSaveCourse,
} from '../lib/creator.ts'
import { type Difficulty, formatMoves, type Side } from '../lib/courses.ts'
import { type EditorLine, linesToTree, mergeLines, patchNode, type Path, type Tree, treeToLines } from '../lib/moveTree.ts'

const field =
  'rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400'

type Meta = Pick<EditableCourse, 'title' | 'pitch' | 'description' | 'side' | 'difficulty'>

/** The editor proper. Mounted fresh (via `key`) whenever saved data is loaded, so its state starts from the server's copy. */
function Editor({ course, lines }: { course: EditableCourse; lines: EditorLine[] }) {
  const navigate = useNavigate()
  const save = useSaveCourse(course.id)
  const remove = useDeleteCourse()
  const publish = usePublishCourse(course.id)
  const [meta, setMeta] = useState<Meta>(course)
  const [tree, setTree] = useState<Tree>(() => linesToTree(lines))
  const [selected, setSelected] = useState<Path>([])
  const [dirty, setDirty] = useState(false)

  const currentLines = treeToLines(tree)
  const set = <K extends keyof Meta>(key: K, value: Meta[K]) => {
    setMeta((m) => ({ ...m, [key]: value }))
    setDirty(true)
  }
  const changeTree = (next: Tree) => {
    setTree(next)
    setDirty(true)
  }

  function onDelete() {
    if (!window.confirm(`Delete "${course.title}" and all its lines? This cannot be undone.`)) return
    remove.mutate(course.id, { onSuccess: () => navigate('/creator/new') })
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit course</h1>
          <p className="text-sm text-slate-400">
            <span data-testid="publish-state">{course.isPublic ? 'Published to the community' : 'Private'}</span> ·{' '}
            <Link to={`/course/${course.slug}`} className="text-emerald-400 hover:underline">
              View course page
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span data-testid="save-state" className="text-sm text-slate-400" aria-live="polite">
            {save.isPending ? 'Saving...' : dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
          <button
            type="button"
            onClick={() => save.mutate({ ...meta, lines: currentLines })}
            disabled={!dirty || save.isPending}
            className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            data-testid="publish-button"
            onClick={() => publish.mutate(!course.isPublic)}
            disabled={dirty || publish.isPending}
            title={dirty ? 'Save your changes first' : undefined}
            className="rounded-md border border-slate-600 px-4 py-2 hover:border-slate-400 disabled:opacity-50"
          >
            {course.isPublic ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </header>

      {publish.isError && (
        <p role="alert" data-testid="publish-error" className="rounded-md border border-amber-500/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {publish.error.message}
        </p>
      )}

      {save.isError && (
        <p role="alert" className="rounded-md border border-red-500/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          Not saved: {save.error.message}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Title
          <input name="title" maxLength={80} value={meta.title} onChange={(e) => set('title', e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          You play
          <select name="side" value={meta.side} onChange={(e) => set('side', e.target.value as Side)} className={field}>
            <option value="WHITE">White</option>
            <option value="BLACK">Black</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Difficulty
          <select
            name="difficulty"
            value={meta.difficulty}
            onChange={(e) => set('difficulty', e.target.value as Difficulty)}
            className={field}
          >
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Pitch (one sentence)
          <input name="pitch" maxLength={160} value={meta.pitch} onChange={(e) => set('pitch', e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Description
          <textarea
            name="description"
            rows={2}
            maxLength={1000}
            value={meta.description}
            onChange={(e) => set('description', e.target.value)}
            className={field}
          />
        </label>
      </section>

      <MoveTreeEditor tree={tree} onChange={changeTree} selected={selected} onSelect={setSelected} side={meta.side} />

      <PgnImporter side={meta.side} onImport={(imported) => changeTree(mergeLines(tree, imported))} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold" data-testid="line-count">
          {currentLines.length} {currentLines.length === 1 ? 'line' : 'lines'}
        </h2>
        <ol className="flex flex-col gap-2">
          {currentLines.map((line, i) => (
            <li key={line.moves.join(' ')} className="flex flex-col gap-1 rounded-lg border border-slate-800 p-3 sm:flex-row sm:items-center sm:gap-3">
              <input
                aria-label={`Name of line ${i + 1}`}
                value={line.name}
                maxLength={120}
                placeholder={`Line ${i + 1}`}
                onChange={(e) => changeTree(patchNode(tree, line.moves, { lineName: e.target.value }))}
                className={`${field} py-1 text-sm sm:w-56`}
              />
              <button
                type="button"
                onClick={() => setSelected(line.moves)}
                className="min-w-0 text-left font-mono text-sm break-words text-slate-400 hover:text-slate-200"
              >
                {formatMoves(line.moves)}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-slate-800 pt-6">
        <button
          type="button"
          onClick={onDelete}
          disabled={remove.isPending}
          className="rounded-md border border-red-500/50 px-3 py-1.5 text-sm text-red-300 hover:border-red-400"
        >
          Delete course
        </button>
      </footer>
    </main>
  )
}

/** /creator/:id: edit a course you own. */
export default function CreatorEdit() {
  const { id = '' } = useParams()
  const { data, isPending, error, dataUpdatedAt } = useEditableCourse(id)

  if (isPending) return <p className="py-24 text-center text-slate-400">Loading course...</p>
  if (error) {
    return (
      <main className="flex flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Cannot open this course</h1>
        <p className="text-slate-400">{error.message}</p>
        <Link to="/creator/new" className="text-emerald-400 underline">
          Your courses
        </Link>
      </main>
    )
  }
  return <Editor key={dataUpdatedAt} course={data.course} lines={data.lines} />
}
