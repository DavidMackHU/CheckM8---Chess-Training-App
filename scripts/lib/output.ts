import { Chess } from 'chess.js'
import type { BuiltLine } from './buildLines.ts'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** The JSON written to content/<slug>.json and read by the seed script. */
export type CourseFile = {
  title: string
  slug: string
  side: 'WHITE' | 'BLACK'
  startFen: string
  keyMoves: string[]
  keyFen: string
  lineCount: number
  lines: { order: number; name: string; moves: string[]; finalFen: string; frequency: number }[]
}

export function toCourseFile(args: {
  title: string
  slug: string
  side: 'white' | 'black'
  keyMoves: string[]
  lines: BuiltLine[]
}): CourseFile {
  const chess = new Chess()
  for (const san of args.keyMoves) chess.move(san)

  // Many lines share one opening name, so each name also lists the opponent's
  // moves that set it apart: "London System: ...Nf6, ...Bf5, ...e6".
  const userMovesFirst = args.side === 'white'
  const lines = args.lines.map((line, i) => {
    const replies = line.moves
      .map((san, ply) => ({ san, ply }))
      .filter(({ ply }) => ply >= args.keyMoves.length && ply < line.branchPly && (ply % 2 === 1) === userMovesFirst)
      .map(({ san }) => (userMovesFirst ? `...${san}` : san))
    const name = replies.length > 0 ? `${line.name}: ${replies.join(', ')}` : line.name
    const { branchPly: _branchPly, ...rest } = line
    return { order: i + 1, ...rest, name }
  })

  return {
    title: args.title,
    slug: args.slug,
    side: args.side === 'white' ? 'WHITE' : 'BLACK',
    startFen: START_FEN,
    keyMoves: args.keyMoves,
    keyFen: chess.fen(),
    lineCount: lines.length,
    lines,
  }
}

function moveText(moves: string[]): string {
  const parts: string[] = []
  moves.forEach((san, i) => parts.push(i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san))
  return parts.join(' ')
}

const quote = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

/** One PGN game per line, so the course can be reviewed in any chess program. */
export function toPgn(course: CourseFile): string {
  return course.lines
    .map((line) =>
      [
        `[Event "${quote(course.title)}"]`,
        `[Round "${line.order}"]`,
        `[White "${course.side === 'WHITE' ? 'You' : 'Opponent'}"]`,
        `[Black "${course.side === 'BLACK' ? 'You' : 'Opponent'}"]`,
        `[Result "*"]`,
        `[Opening "${quote(line.name)}"]`,
        '',
        `${moveText(line.moves)} *`,
        '',
      ].join('\n'),
    )
    .join('\n')
}
