import { Link } from 'react-router'
import type { CourseProgress } from '../lib/stats.ts'
import { SideBadge } from './CourseCard.tsx'

const pct = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0)

/** One enrolled course: a learned/mastered bar, its counts, and what to do next. */
export default function CourseProgressRow({ course }: { course: CourseProgress }) {
  const learning = course.learned - course.mastered

  return (
    <li data-testid="course-progress" className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/course/${course.slug}`} className="font-semibold hover:text-emerald-400">
          {course.title}
        </Link>
        <SideBadge side={course.side} />
      </div>

      {/* Two segments of one hue: mastered (bright) then still learning (dim), with a gap between. */}
      <div
        className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-800"
        role="img"
        aria-label={`${course.mastered} mastered, ${learning} learning, ${course.new} new, of ${course.total} lines`}
      >
        {course.mastered > 0 && <div className="bg-emerald-400" style={{ width: `${pct(course.mastered, course.total)}%` }} />}
        {learning > 0 && <div className="bg-emerald-700" style={{ width: `${pct(learning, course.total)}%` }} />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-slate-400">
        <p>
          <span className="text-slate-200">{course.learned}</span> of {course.total} learned ·{' '}
          <span className="text-slate-200">{course.mastered}</span> mastered
          {course.due > 0 && (
            <>
              {' '}
              · <span className="text-slate-200">{course.due}</span> due
            </>
          )}
        </p>
        {course.new > 0 ? (
          <Link to={`/train/learn/${course.id}`} className="text-emerald-400 hover:underline">
            Learn new lines
          </Link>
        ) : (
          <span>All lines learned</span>
        )}
      </div>
    </li>
  )
}
