import { type CourseFilterValues, EMPTY_FILTERS } from '../lib/courses.ts'

type Props = {
  value: CourseFilterValues
  onChange: (next: CourseFilterValues) => void
  /** Community page: every course is a community course, so hide the source filter and offer sorting. */
  communityOnly?: boolean
}

type Option = { value: string; label: string }

const SIDE: Option[] = [
  { value: '', label: 'Any side' },
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
]
const FIRST: Option[] = [
  { value: '', label: 'Any first move' },
  { value: 'e4', label: '1. e4' },
  { value: 'd4', label: '1. d4' },
  { value: 'other', label: 'Other' },
]
const DIFFICULTY: Option[] = [
  { value: '', label: 'Any difficulty' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]
const SOURCE: Option[] = [
  { value: '', label: 'Official + community' },
  { value: 'false', label: 'Official only' },
  { value: 'true', label: 'Community only' },
]

const SORT: Option[] = [
  { value: '', label: 'Most upvoted' },
  { value: 'new', label: 'Newest' },
]

const fieldClass =
  'rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400'

export default function CourseFilters({ value, onChange, communityOnly = false }: Props) {
  const set = (key: keyof CourseFilterValues, v: string) => onChange({ ...value, [key]: v } as CourseFilterValues)
  const isFiltered = Object.values(value).some(Boolean)

  const select = (key: keyof CourseFilterValues, label: string, options: Option[]) => (
    <select aria-label={label} value={value[key]} onChange={(e) => set(key, e.target.value)} className={fieldClass}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="course-filters">
      <input
        type="search"
        aria-label="Search courses"
        placeholder="Search courses"
        value={value.q}
        onChange={(e) => set('q', e.target.value)}
        className={`${fieldClass} min-w-40 flex-1`}
      />
      {select('side', 'Side', SIDE)}
      {select('first', 'First move', FIRST)}
      {select('difficulty', 'Difficulty', DIFFICULTY)}
      {communityOnly ? select('sort', 'Sort by', SORT) : select('community', 'Source', SOURCE)}
      {isFiltered && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="px-2 text-sm text-slate-400 underline hover:text-white"
        >
          Clear
        </button>
      )}
    </div>
  )
}
