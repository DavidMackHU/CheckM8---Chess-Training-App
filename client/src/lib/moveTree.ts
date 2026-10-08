/**
 * The course creator's move tree. A course is stored as flat lines; while
 * editing it is a tree, where every leaf is one line. All functions return new
 * trees and never change their input.
 */
export type TreeNode = {
  san: string
  comment: string
  /** Name of the line that ends here. Only meaningful on leaves. */
  lineName: string
  children: TreeNode[]
}

/** The root is the starting position; its children are the first moves. */
export type Tree = TreeNode[]
export type Path = string[]

export type EditorLine = { name: string; moves: string[]; comments: Record<string, string> }

const node = (san: string): TreeNode => ({ san, comment: '', lineName: '', children: [] })

export function linesToTree(lines: EditorLine[]): Tree {
  const root: Tree = []
  for (const line of lines) {
    let level = root
    let last: TreeNode | undefined
    line.moves.forEach((san, i) => {
      let child = level.find((n) => n.san === san)
      if (!child) {
        child = node(san)
        level.push(child)
      }
      const comment = line.comments[String(i + 1)]
      if (comment) child.comment = comment
      last = child
      level = child.children
    })
    if (last && line.name) last.lineName = line.name
  }
  return root
}

/** Every leaf as a line, in tree order. Comments are collected along the path. */
export function treeToLines(tree: Tree): EditorLine[] {
  const lines: EditorLine[] = []
  const walk = (nodes: TreeNode[], moves: string[], comments: Record<string, string>) => {
    for (const n of nodes) {
      const nextMoves = [...moves, n.san]
      const nextComments = n.comment ? { ...comments, [nextMoves.length]: n.comment } : comments
      if (n.children.length === 0) lines.push({ name: n.lineName, moves: nextMoves, comments: nextComments })
      else walk(n.children, nextMoves, nextComments)
    }
  }
  walk(tree, [], {})
  return lines
}

export function findNode(tree: Tree, path: Path): TreeNode | null {
  let level = tree
  let found: TreeNode | null = null
  for (const san of path) {
    found = level.find((n) => n.san === san) ?? null
    if (!found) return null
    level = found.children
  }
  return found
}

/** Rebuilds the tree with `change` applied to the children list found at `path`. */
function updateChildren(tree: Tree, path: Path, change: (children: TreeNode[]) => TreeNode[]): Tree {
  if (path.length === 0) return change(tree)
  const [head, ...rest] = path
  return tree.map((n) => (n.san === head ? { ...n, children: updateChildren(n.children, rest, change) } : n))
}

/** Adds `san` as a reply at `path` (no-op if it is already there). */
export function addMove(tree: Tree, path: Path, san: string): Tree {
  return updateChildren(tree, path, (children) =>
    children.some((n) => n.san === san) ? children : [...children, node(san)],
  )
}

/** Removes the move at `path` and everything after it. */
export function removeMove(tree: Tree, path: Path): Tree {
  if (path.length === 0) return tree
  const last = path[path.length - 1]
  return updateChildren(tree, path.slice(0, -1), (children) => children.filter((n) => n.san !== last))
}

export function patchNode(tree: Tree, path: Path, patch: Partial<Pick<TreeNode, 'comment' | 'lineName'>>): Tree {
  if (path.length === 0) return tree
  const last = path[path.length - 1]
  return updateChildren(tree, path.slice(0, -1), (children) =>
    children.map((n) => (n.san === last ? { ...n, ...patch } : n)),
  )
}

/** Adds every line to the tree, keeping what is already there. Used by PGN import. */
export function mergeLines(tree: Tree, lines: EditorLine[]): Tree {
  return linesToTree([...treeToLines(tree), ...lines])
}

/** "3. Bf4" for White's moves, "3... Nf6" for Black's. `ply` is 0-based. */
export function numbered(ply: number, san: string, afterBranch = false): string {
  const n = Math.floor(ply / 2) + 1
  if (ply % 2 === 0) return `${n}. ${san}`
  return afterBranch ? `${n}... ${san}` : san
}
