// Filtering a course's lines on the course page. Pure functions, so they can be unit tested.

export type LineProgress = 'new' | 'learning' | 'due' | 'mastered'

export type FilterableLine = { id: string; name: string; moves: string[]; tags: string[] }

export type LineFilters = {
  type: string
  style: string
  variation: string
  progress: string
  q: string
}

export const NO_FILTERS: LineFilters = { type: '', style: '', variation: '', progress: '', q: '' }

export const TYPE_OPTIONS = [
  { value: 'main', label: 'Main lines' },
  { value: 'sideline', label: 'Sidelines' },
  { value: 'checkmate', label: 'Checkmate traps' },
  { value: 'punish', label: 'Punish a mistake' },
] as const

export const STYLE_OPTIONS = [
  { value: 'tactical', label: 'Tactical' },
  { value: 'positional', label: 'Positional' },
] as const

export const PROGRESS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'learning', label: 'Learning' },
  { value: 'due', label: 'Due now' },
  { value: 'mastered', label: 'Mastered' },
] as const

/**
 * The opening variation a line belongs to, from its name:
 * "Caro-Kann Defense: Panov Attack: ...Nf6, ...e6" -> "Caro-Kann Defense: Panov Attack".
 * Added lines ("Punish: Vienna Game: 3... Qf6 (+2.4)") belong to their opening.
 */
export function variationOf(name: string): string {
  const withoutKind = name.replace(/^(Checkmate|Punish): /, '')
  const parts = withoutKind.split(': ')
  if (parts.length === 1) return withoutKind
  // The last part names the opponent's moves (generated lines) or the mistake (added lines).
  return parts.slice(0, -1).join(': ')
}

/** Every variation in the course, in the order they first appear. */
export function variationsOf(lines: FilterableLine[]): string[] {
  return [...new Set(lines.map((l) => variationOf(l.name)))]
}

export function matchesFilters(line: FilterableLine, progress: LineProgress, f: LineFilters): boolean {
  if (f.type && !line.tags.includes(f.type)) return false
  if (f.style && !line.tags.includes(f.style)) return false
  if (f.variation && variationOf(line.name) !== f.variation) return false
  if (f.progress && progress !== f.progress) return false
  const q = f.q.trim().toLowerCase()
  if (q) {
    // Matches the name, or a move anywhere in the line ("nf6", "Bxf7+").
    const inName = line.name.toLowerCase().includes(q)
    const inMoves = line.moves.some((m) => m.toLowerCase().replace(/[+#]/g, '') === q.replace(/[+#]/g, ''))
    if (!inName && !inMoves) return false
  }
  return true
}
