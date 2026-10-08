import { Link } from 'react-router'
import { type CourseCard as Course, DIFFICULTY_LABEL, SIDE_LABEL } from '../lib/courses.ts'
import BoardThumbnail from './BoardThumbnail.tsx'

export function SideBadge({ side }: { side: Course['side'] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
      <span
        className={`h-2.5 w-2.5 rounded-full border border-slate-500 ${side === 'WHITE' ? 'bg-white' : 'bg-slate-950'}`}
      />
      {SIDE_LABEL[side]}
    </span>
  )
}

export default function CourseCard({ course }: { course: Course }) {
  return (
    <Link
      to={`/course/${course.slug}`}
      data-testid="course-card"
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition hover:border-emerald-500/60"
    >
      <div className="p-3 pb-0">
        <BoardThumbnail fen={course.keyFen} orientation={course.side === 'WHITE' ? 'white' : 'black'} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-lg font-semibold group-hover:text-emerald-400">{course.title}</h3>
        <p className="line-clamp-2 min-h-10 text-sm text-slate-400">{course.pitch || 'Pitch coming soon.'}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-400">
          <SideBadge side={course.side} />
          <span>{course.lineCount} lines</span>
          <span aria-hidden="true">·</span>
          <span>{DIFFICULTY_LABEL[course.difficulty]}</span>
        </div>
        <p className="text-xs text-slate-500">
          by {course.author}
          {!course.isOfficial && (
            <span data-testid="card-upvotes">
              {' '}
              · {course.upvotes} {course.upvotes === 1 ? 'upvote' : 'upvotes'}
            </span>
          )}
        </p>
      </div>
    </Link>
  )
}
