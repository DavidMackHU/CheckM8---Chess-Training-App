import { defaultPieces } from 'react-chessboard'
import type { PromotionPiece } from '../lib/chess/game.ts'

type Props = {
  color: 'w' | 'b'
  /** Called with the chosen piece, or null if the user cancels. */
  onChoose: (piece: PromotionPiece | null) => void
}

const CHOICES: { piece: PromotionPiece; label: string }[] = [
  { piece: 'q', label: 'Queen' },
  { piece: 'r', label: 'Rook' },
  { piece: 'b', label: 'Bishop' },
  { piece: 'n', label: 'Knight' },
]

/** Overlay shown on the board when a pawn reaches the last rank. */
export default function PromotionPicker({ color, onChoose }: Props) {
  return (
    <div
      role="dialog"
      aria-label="Choose promotion piece"
      className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/60"
      onClick={() => onChoose(null)}
    >
      <div className="flex gap-2 rounded-lg bg-slate-800 p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {CHOICES.map(({ piece, label }) => {
          const Piece = defaultPieces[`${color}${piece.toUpperCase()}`]
          return (
            <button
              key={piece}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => onChoose(piece)}
              className="h-14 w-14 rounded-md bg-slate-200 p-1 hover:bg-emerald-300 sm:h-16 sm:w-16"
            >
              {Piece ? <Piece /> : label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
