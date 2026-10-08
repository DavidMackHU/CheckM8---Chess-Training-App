import { Chess, type Square } from 'chess.js'
import { useMemo } from 'react'
import type { MoveInput } from '../lib/chess/game.ts'
import { playSound } from '../lib/chess/sounds.ts'
import { addMove, findNode, patchNode, type Path, removeMove, type Tree } from '../lib/moveTree.ts'
import Board from './Board.tsx'
import MoveTreeView from './MoveTreeView.tsx'

type Props = {
  tree: Tree
  onChange: (tree: Tree) => void
  selected: Path
  onSelect: (path: Path) => void
  side: 'WHITE' | 'BLACK'
}

const smallButton =
  'rounded-md border border-slate-700 px-2.5 py-1 text-sm hover:border-slate-500 disabled:opacity-40'

/**
 * Board plus move tree. Selecting a move shows its position; playing any legal
 * move on the board adds it as a reply there (or jumps to it if it exists).
 */
export default function MoveTreeEditor({ tree, onChange, selected, onSelect, side }: Props) {
  const chess = useMemo(() => {
    const game = new Chess()
    for (const san of selected) game.move(san)
    return game
  }, [selected])
  const fen = chess.fen()
  const node = findNode(tree, selected)
  const history = chess.history({ verbose: true })
  const last = history.at(-1)
  // The first reply from here, for the Forward button.
  const nextSan = (selected.length === 0 ? tree[0] : node?.children[0])?.san

  function onMove(input: MoveInput): boolean {
    let san: string
    try {
      san = new Chess(fen).move(input).san
    } catch {
      return false
    }
    onChange(addMove(tree, selected, san))
    onSelect([...selected, san])
    playSound('move')
    return true
  }

  function deleteSelected() {
    onChange(removeMove(tree, selected))
    onSelect(selected.slice(0, -1))
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" data-testid="tree-editor">
      <div className="mx-auto w-full max-w-[32rem]">
        <Board
          fen={fen}
          orientation={side === 'WHITE' ? 'white' : 'black'}
          onMove={onMove}
          getLegalTargets={(square) => [
            ...new Set(chess.moves({ square: square as Square, verbose: true }).map((m) => m.to)),
          ]}
          needsPromotion={(from, to) =>
            chess.moves({ square: from as Square, verbose: true }).some((m) => m.to === to && m.isPromotion())
          }
          lastMove={last ? { from: last.from, to: last.to } : null}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={smallButton} onClick={() => onSelect([])} disabled={selected.length === 0}>
            Start
          </button>
          <button
            type="button"
            className={smallButton}
            onClick={() => onSelect(selected.slice(0, -1))}
            disabled={selected.length === 0}
          >
            Back
          </button>
          <button
            type="button"
            className={smallButton}
            onClick={() => nextSan && onSelect([...selected, nextSan])}
            disabled={!nextSan}
          >
            Forward
          </button>
          <button
            type="button"
            className={`${smallButton} text-red-300`}
            onClick={deleteSelected}
            disabled={selected.length === 0}
          >
            Delete this move
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="max-h-[26rem] overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-3">
          <MoveTreeView tree={tree} selected={selected} onSelect={onSelect} userColor={side === 'WHITE' ? 'w' : 'b'} />
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-400">
            {node ? `Comment for ${node.san}` : 'Select a move to add a comment'}
          </span>
          <textarea
            rows={3}
            maxLength={500}
            disabled={!node}
            value={node?.comment ?? ''}
            onChange={(e) => onChange(patchNode(tree, selected, { comment: e.target.value }))}
            placeholder="The plan, the trap, the pawn break..."
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400 disabled:opacity-50"
          />
        </label>
        <p className="text-xs text-slate-500">
          Play a move on the board to add it. Each branch end becomes one line and must end on your own move.
        </p>
      </div>
    </div>
  )
}
