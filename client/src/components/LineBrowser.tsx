import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { type CourseLine, formatMoves, type LineProgressMap } from '../lib/courses.ts'
import {
  type LineFilters,
  type LineProgress,
  matchesFilters,
  NO_FILTERS,
  PROGRESS_OPTIONS,
  STYLE_OPTIONS,
  TYPE_OPTIONS,
  variationsOf,
} from '../lib/lineFilters.ts'

type Props = {
  courseId: string
  lines: CourseLine[]
  keyPly: number
  progress: LineProgressMap
  /** Only enrolled players can pick lines to train, and only they have progress. */
  canTrain: boolean
}

const fieldClass =
  'min-h-11 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400'

const TAG_LABEL: Record<string, string> = {
  main: 'Main line',
  sideline: 'Sideline',
  checkmate: 'Checkmate',
  punish: 'Punish',
  tactical: 'Tactical',
  positional: 'Positional',
}
const TAG_STYLE: Record<string, string> = {
  checkmate: 'border-red-500/50 text-red-300',
  punish: 'border-amber-500/50 text-amber-300',
  main: 'border-emerald-500/50 text-emerald-300',
}
const PROGRESS_STYLE: Record<LineProgress, string> = {
  new: 'text-slate-500',
  learning: 'text-sky-300',
  due: 'text-amber-300',
  mastered: 'text-emerald-400',
}

function Select({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly { value: string; label: string }[]
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
      <option value="">{`Any ${label.toLowerCase()}`}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** The course's lines with filters, search and checkboxes for picking which to train. */
export default function LineBrowser({ courseId, lines, keyPly, progress, canTrain }: Props) {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<LineFilters>(NO_FILTERS)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const set = (key: keyof LineFilters) => (v: string) => setFilters((f) => ({ ...f, [key]: v }))

  const variations = useMemo(() => variationsOf(lines).map((v) => ({ value: v, label: v })), [lines])
  const progressOf = (id: string): LineProgress => progress[id] ?? 'new'
  const shown = lines.filter((line) => matchesFilters(line, progressOf(line.id), filters))
  const filtered = Object.values(filters).some(Boolean)
  const allShownPicked = shown.length > 0 && shown.every((l) => picked.has(l.id))

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const pickShown = () =>
    setPicked((p) => {
      const next = new Set(p)
      for (const l of shown) {
        if (allShownPicked) next.delete(l.id)
        else next.add(l.id)
      }
      return next
    })
  const train = (ids: string[]) => {
    const ordered = lines.filter((l) => ids.includes(l.id)).map((l) => l.id)
    navigate(`/train/lines/${courseId}?ids=${ordered.join(',')}`)
  }

  return (
    <section className="flex flex-col gap-3" data-testid="line-browser">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">Lines</h2>
        <p data-testid="line-count" className="text-sm text-slate-400">
          {filtered ? `${shown.length} of ${lines.length} lines` : `${lines.length} lines`}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <input
          type="search"
          aria-label="Search lines"
          placeholder="Search by name or move, e.g. Nf6"
          value={filters.q}
          onChange={(e) => set('q')(e.target.value)}
          className={`${fieldClass} sm:col-span-2 lg:col-span-3`}
        />
        <Select label="Type" value={filters.type} onChange={set('type')} options={TYPE_OPTIONS} />
        <Select label="Style" value={filters.style} onChange={set('style')} options={STYLE_OPTIONS} />
        {variations.length > 1 && <Select label="Variation" value={filters.variation} onChange={set('variation')} options={variations} />}
        {canTrain && <Select label="Progress" value={filters.progress} onChange={set('progress')} options={PROGRESS_OPTIONS} />}
        {filtered && (
          <button type="button" onClick={() => setFilters(NO_FILTERS)} className="min-h-11 text-left text-sm text-emerald-400 underline">
            Clear filters
          </button>
        )}
      </div>

      {canTrain && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/95 px-3 py-2">
          <button type="button" onClick={pickShown} disabled={shown.length === 0} className="min-h-11 text-sm text-slate-300 hover:text-white disabled:opacity-40">
            {allShownPicked ? 'Clear selection' : filtered ? `Select all ${shown.length} shown` : 'Select all'}
          </button>
          <button
            type="button"
            data-testid="train-selected"
            onClick={() => train([...picked])}
            disabled={picked.size === 0}
            className="ml-auto min-h-11 rounded-md bg-emerald-500 px-4 font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
          >
            Train selected ({picked.size})
          </button>
        </div>
      )}

      {shown.length === 0 ? (
        <p data-testid="no-lines" className="py-8 text-center text-slate-400">
          No lines match these filters.
        </p>
      ) : (
        <ol data-testid="line-list" className="divide-y divide-slate-800 rounded-xl border border-slate-800">
          {shown.map((line) => {
            const state = progressOf(line.id)
            const keyText = formatMoves(line.moves.slice(0, keyPly))
            return (
              <li key={line.id} data-line-id={line.id} className="flex gap-3 px-3 py-3 sm:px-4">
                {canTrain && (
                  <input
                    type="checkbox"
                    aria-label={`Select ${line.name}`}
                    checked={picked.has(line.id)}
                    onChange={() => toggle(line.id)}
                    className="mt-1 h-5 w-5 shrink-0 accent-emerald-500"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="mr-2 text-sm text-slate-500">{line.order}.</span>
                    {line.name}
                  </p>
                  <p className="font-mono text-sm break-words text-slate-400">
                    <span className="text-slate-600">{keyText}</span> {formatMoves(line.moves).slice(keyText.length).trim()}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    {line.tags.map((tag) => (
                      <span key={tag} className={`rounded-full border px-2 py-0.5 ${TAG_STYLE[tag] ?? 'border-slate-700 text-slate-400'}`}>
                        {TAG_LABEL[tag] ?? tag}
                      </span>
                    ))}
                    {canTrain && <span className={`ml-1 ${PROGRESS_STYLE[state]}`}>{PROGRESS_OPTIONS.find((o) => o.value === state)?.label}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                  {canTrain && (
                    <button type="button" onClick={() => train([line.id])} className="min-h-9 text-emerald-400 hover:underline">
                      Train
                    </button>
                  )}
                  <Link to={`/analysis?fen=${encodeURIComponent(line.finalFen)}`} className="text-slate-400 hover:text-emerald-400">
                    View position
                  </Link>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
