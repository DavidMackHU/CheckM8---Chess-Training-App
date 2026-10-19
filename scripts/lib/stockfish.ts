import { createRequire } from 'node:module'
import path from 'node:path'

// Stockfish (GPLv3) from the `stockfish` npm package, run in Node for content tools.

export type Analysis = {
  /** Moves to mate for the side to move (negative: being mated), or null if no mate was found. */
  mate: number | null
  /** Best line in UCI, e.g. ["e2e4", "e7e5"]. */
  pv: string[]
}

export interface Engine {
  analyse(fen: string, depth: number): Promise<Analysis>
  quit(): void
}

type RawEngine = { listener?: (line: string) => void; sendCommand(cmd: string): void; terminate?: () => void }

/** Starts the single-threaded lite build, the same one the analysis board uses. */
export async function startStockfish(root: string): Promise<Engine> {
  const require = createRequire(import.meta.url)
  const init = require('stockfish') as (enginePath: string) => Promise<RawEngine>
  // The engine's loader sets the global fetch to null in Node (it reads its
  // .wasm file another way). Put it back so the rest of the script can use it.
  const savedFetch = globalThis.fetch
  const raw = await init(path.join(root, 'node_modules', 'stockfish', 'bin', 'stockfish-19-lite-single.js'))
  globalThis.fetch = savedFetch

  let waiting: ((line: string) => void) | null = null
  raw.listener = (line) => waiting?.(line)
  raw.sendCommand('uci')
  raw.sendCommand('setoption name Hash value 64')

  // One search at a time: each call waits for the previous "bestmove".
  let queue = Promise.resolve()
  function analyse(fen: string, depth: number): Promise<Analysis> {
    const run = queue.then(
      () =>
        new Promise<Analysis>((resolve) => {
          let last: Analysis = { mate: null, pv: [] }
          waiting = (line) => {
            if (line.startsWith('info') && line.includes(' pv ') && !line.includes('multipv 2')) {
              const mate = /score mate (-?\d+)/.exec(line)
              last = { mate: mate ? Number(mate[1]) : null, pv: line.slice(line.indexOf(' pv ') + 4).trim().split(/\s+/) }
            } else if (line.startsWith('bestmove')) {
              waiting = null
              resolve(last)
            }
          }
          raw.sendCommand('ucinewgame')
          raw.sendCommand(`position fen ${fen}`)
          raw.sendCommand(`go depth ${depth}`)
        }),
    )
    queue = run.then(() => undefined)
    return run
  }

  return { analyse, quit: () => raw.sendCommand('quit') }
}
