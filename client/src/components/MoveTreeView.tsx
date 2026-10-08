import type { ReactNode } from 'react'
import { numbered, type Path, type Tree, type TreeNode } from '../lib/moveTree.ts'

type Props = {
  tree: Tree
  selected: Path
  onSelect: (path: Path) => void
  /** 'w' or 'b': a line must end on this side's move. */
  userColor: 'w' | 'b'
}

const samePath = (a: Path, b: Path) => a.length === b.length && a.every((san, i) => san === b[i])

/**
 * The move tree as text. A run of single replies stays on one row; where the
 * tree branches, each alternative starts its own indented row.
 */
export default function MoveTreeView({ tree, selected, onSelect, userColor }: Props) {
  function moveButton(node: TreeNode, path: Path, afterBranch: boolean): ReactNode {
    const ply = path.length - 1
    const isLeaf = node.children.length === 0
    // Ply 0 is White's move. A leaf played by the opponent will be trimmed on save.
    const endsOnOpponent = isLeaf && (ply % 2 === 0 ? 'w' : 'b') !== userColor
    const isSelected = samePath(path, selected)
    return (
      <button
        key={path.join(' ')}
        type="button"
        data-path={path.join(' ')}
        aria-current={isSelected || undefined}
        title={endsOnOpponent ? "Ends on the opponent's move. Add your reply, or it will be dropped on save." : undefined}
        onClick={() => onSelect(path)}
        className={`rounded px-1.5 py-0.5 font-mono text-sm ${
          isSelected ? 'bg-emerald-500 text-slate-950' : 'text-slate-200 hover:bg-slate-800'
        } ${endsOnOpponent && !isSelected ? 'underline decoration-amber-400 decoration-dotted underline-offset-4' : ''}`}
      >
        {numbered(ply, node.san, afterBranch)}
        {node.comment && <span aria-label="has a comment"> *</span>}
      </button>
    )
  }

  /** Renders `node` and everything after it. */
  function branch(node: TreeNode, path: Path, afterBranch: boolean): ReactNode {
    const run: ReactNode[] = []
    let current = node
    let currentPath = path
    let first = afterBranch
    for (;;) {
      run.push(moveButton(current, currentPath, first))
      first = false
      if (current.children.length !== 1) break
      current = current.children[0]
      currentPath = [...currentPath, current.san]
    }
    return (
      <>
        <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1">{run}</div>
        {current.children.length > 1 && (
          <ul className="mt-1 ml-3 flex flex-col gap-1 border-l border-slate-700 pl-3">
            {current.children.map((child) => (
              <li key={child.san}>{branch(child, [...currentPath, child.san], true)}</li>
            ))}
          </ul>
        )}
      </>
    )
  }

  if (tree.length === 0) {
    return <p className="text-sm text-slate-500">No moves yet. Play the first move on the board.</p>
  }

  return (
    <div data-testid="move-tree">
      {tree.length === 1 ? (
        branch(tree[0], [tree[0].san], false)
      ) : (
        <ul className="flex flex-col gap-1">
          {tree.map((child) => (
            <li key={child.san}>{branch(child, [child.san], true)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
