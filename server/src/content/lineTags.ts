import { Chess } from 'chess.js'

/**
 * Tags that let players filter a course's lines. Worked out when lines are
 * saved (seed, course editor), from the moves themselves:
 *  - type:  main (among the course's most common lines), sideline, checkmate (a trap that ends in mate),
 *           punish (shows how to punish a common mistake)
 *  - style: tactical (captures and checks after the key moves) or positional (quiet, plan-based)
 */
export const LINE_TYPES = ['main', 'sideline', 'checkmate', 'punish'] as const
export const LINE_STYLES = ['tactical', 'positional'] as const
export type LineType = (typeof LINE_TYPES)[number]

/** Captures count 1 for a pawn and 2 for a piece, checks count 2. At or above this the line is tactical. */
export const TACTICAL_SCORE = 6

/** Which kind of added line a name marks, from the content tools ("Checkmate: ...", "Punish: ..."). */
export function kindFromName(name: string): 'checkmate' | 'punish' | null {
  if (name.startsWith('Checkmate: ')) return 'checkmate'
  if (name.startsWith('Punish: ')) return 'punish'
  return null
}

export function tacticsScore(moves: string[], keyPly: number, startFen?: string): number {
  const chess = startFen ? new Chess(startFen) : new Chess()
  let score = 0
  moves.forEach((san, ply) => {
    const move = chess.move(san)
    if (ply < keyPly) return
    if (move.captured) score += move.captured === 'p' ? 1 : 2
    if (/[+#]/.test(move.san)) score += 2
  })
  return score
}

export function lineTags(args: { moves: string[]; keyPly: number; type: LineType; startFen?: string }): string[] {
  const { moves, keyPly, type, startFen } = args
  const endsInMate = moves.at(-1)?.endsWith('#') ?? false
  const tactical = endsInMate || tacticsScore(moves, keyPly, startFen) >= TACTICAL_SCORE
  return [type, tactical ? 'tactical' : 'positional']
}

/**
 * Types for a generated course: the added lines keep their kind, and the
 * most common third of the rest (by how often games reach them) are "main".
 * Without frequencies, every ordinary line counts as main.
 */
export function lineTypes(lines: { name: string; frequency?: number }[]): LineType[] {
  const ordinary = lines.filter((l) => kindFromName(l.name) === null)
  const ranked = ordinary.filter((l) => typeof l.frequency === 'number').sort((a, b) => b.frequency! - a.frequency!)
  const mainCount = Math.max(1, Math.ceil(ranked.length / 3))
  const main = new Set(ranked.slice(0, mainCount))
  return lines.map((line) => {
    const kind = kindFromName(line.name)
    if (kind) return kind
    if (ranked.length === 0) return 'main'
    return main.has(line) ? 'main' : 'sideline'
  })
}
