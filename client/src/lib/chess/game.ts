import { Chess, type Square } from 'chess.js'

export type PromotionPiece = 'q' | 'r' | 'b' | 'n'
export type MoveInput = { from: string; to: string; promotion?: PromotionPiece }

/** What happened when a move was played. Drives the move list, highlights and sounds. */
export type MoveOutcome = {
  san: string
  from: string
  to: string
  fenAfter: string
  capture: boolean
  check: boolean
  mate: boolean
  castle: boolean
  promotion: boolean
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** Plays a move on the given game. Returns null (and leaves the game unchanged) if illegal. */
export function playMove(chess: Chess, input: MoveInput | string): MoveOutcome | null {
  try {
    const move = chess.move(input)
    return {
      san: move.san,
      from: move.from,
      to: move.to,
      fenAfter: chess.fen(),
      capture: move.isCapture() || move.isEnPassant(),
      check: chess.isCheck(),
      mate: chess.isCheckmate(),
      castle: move.isKingsideCastle() || move.isQueensideCastle(),
      promotion: move.isPromotion(),
    }
  } catch {
    return null
  }
}

/** Squares the piece on `square` can legally move to. Empty if none or not its turn. */
export function legalTargets(chess: Chess, square: string): string[] {
  const moves = chess.moves({ square: square as Square, verbose: true })
  return [...new Set(moves.map((m) => m.to))]
}

/** True if moving from -> to is a legal pawn promotion, so a piece must be chosen. */
export function isPromotionMove(chess: Chess, from: string, to: string): boolean {
  return chess
    .moves({ square: from as Square, verbose: true })
    .some((m) => m.to === to && m.isPromotion())
}

export type GameStatus =
  | 'playing'
  | 'checkmate'
  | 'stalemate'
  | 'draw'

export function gameStatus(chess: Chess): GameStatus {
  if (chess.isCheckmate()) return 'checkmate'
  if (chess.isStalemate()) return 'stalemate'
  if (chess.isDraw()) return 'draw'
  return 'playing'
}

/** Square of the king that is currently in check, or null. */
export function checkedKingSquare(chess: Chess): string | null {
  if (!chess.isCheck()) return null
  const turn = chess.turn()
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece && piece.type === 'k' && piece.color === turn) return piece.square
    }
  }
  return null
}

/** The SAN a move would have in this position, or null if it is illegal. Does not change any game. */
export function sanFor(fen: string, input: MoveInput): string | null {
  return playMove(new Chess(fen), input)?.san ?? null
}

/** From/to squares of a SAN move in this position (for drawing a hint arrow), or null if illegal. */
export function squaresFor(fen: string, san: string): { from: string; to: string } | null {
  const outcome = playMove(new Chess(fen), san)
  return outcome ? { from: outcome.from, to: outcome.to } : null
}

/** The game as PGN text. Games from a custom position carry it in the FEN header. */
export function toPgn(startFen: string, moves: string[]): string {
  if (moves.length === 0) return ''
  const chess = new Chess(startFen)
  if (startFen !== START_FEN) {
    chess.setHeader('SetUp', '1')
    chess.setHeader('FEN', startFen)
  }
  for (const san of moves) chess.move(san)
  return chess.pgn()
}

/** Reads the main line of a PGN. Variations and comments are ignored. Returns null if it cannot be read. */
export function readPgn(pgn: string): { startFen: string; moves: string[] } | null {
  try {
    const chess = new Chess()
    chess.loadPgn(pgn.trim())
    const moves = chess.history()
    if (moves.length === 0) return null
    return { startFen: chess.getHeaders().FEN ?? START_FEN, moves }
  } catch {
    return null
  }
}
