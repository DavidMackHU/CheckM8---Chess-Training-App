import { useEffect, useState } from 'react'
import { type CourseFilterValues, EMPTY_FILTERS, useCourses } from '../lib/courses.ts'
import CourseCard from './CourseCard.tsx'
import CourseFilters from './CourseFilters.tsx'

/** Delays a fast-changing value so typing in the search box does not fire a request per key. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

/** Filter bar plus the grid of course cards. Used on the home page and /openings. */
export default function CourseCatalog({ communityOnly = false }: { communityOnly?: boolean }) {
  const [filters, setFilters] = useState<CourseFilterValues>(EMPTY_FILTERS)
  const debouncedQ = useDebounced(filters.q, 250)
  const courses = useCourses({ ...filters, q: debouncedQ, ...(communityOnly ? { community: 'true' as const } : {}) })
  const isFiltered = Object.values(filters).some(Boolean)

  return (
    <section className="flex flex-col gap-5">
      <CourseFilters value={filters} onChange={setFilters} communityOnly={communityOnly} />

      {courses.isPending && <p className="py-12 text-center text-slate-400">Loading courses...</p>}

      {courses.isError && (
        <p role="alert" className="py-12 text-center text-red-400">
          Could not load courses. {courses.error.message}
        </p>
      )}

      {courses.data && courses.data.length === 0 && (
        <p data-testid="no-courses" className="py-12 text-center text-slate-400">
          {isFiltered
            ? 'No courses match these filters.'
            : communityOnly
              ? 'No community courses yet. Be the first to publish one.'
              : 'No courses yet. Check back soon.'}
        </p>
      )}

      {courses.data && courses.data.length > 0 && (
        <div
          className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${courses.isPlaceholderData ? 'opacity-60' : ''}`}
        >
          {courses.data.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </section>
  )
}
