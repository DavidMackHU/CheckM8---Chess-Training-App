import { Chess } from 'chess.js'
import { useEffect, useRef, useState } from 'react'

/** What the engine currently thinks of a position. Scores are from White's point of view. */
export type EngineInfo = {
  fen: string
  depth: number
  /** Centipawns (100 = one pawn) for White, or null when a forced mate is found. */
  cp: number | null
  /** Moves until mate: positive if White mates, negative if Black does. Null when no mate is seen. */
  mate: number | null
  /** The engine's main line as SAN moves. */
  line: string[]
  /** First move of the main line, for drawing an arrow. */
  best: { from: string; to: string } | null
  /** True once the search has finished. */
  done: boolean
}

export type EngineStatus = 'off' | 'loading' | 'thinking' | 'done' | 'error'

const ENGINE_URL = '/stockfish/stockfish.js'
const DEPTH = 18

/** Turns the engine's own move format (e2e4, e7e8q) into SAN, stopping at the first move that does not fit. */
function toSan(fen: string, uciMoves: string[]): { line: string[]; best: EngineInfo['best'] } {
  const chess = new Chess(fen)
  const line: string[] = []
  let best: EngineInfo['best'] = null
  for (const uci of uciMoves) {
    try {
      const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      if (!best) best = { from: move.from, to: move.to }
      line.push(move.san)
    } catch {
      break
    }
  }
  return { line, best }
}

/** Reads one "info depth ... score ... pv ..." line. Returns null for lines without a score and a line. */
export function parseInfo(text: string, fen: string): Omit<EngineInfo, 'done'> | null {
  const depth = /\bdepth (\d+)/.exec(text)
  const score = /\bscore (cp|mate) (-?\d+)/.exec(text)
  const pv = /\bpv (.+)$/.exec(text)
  if (!depth || !score || !pv) return null
  // The engine reports from the side to move; flip so positive always means White is better.
  const sign = fen.split(' ')[1] === 'b' ? -1 : 1
  const value = Number(score[2]) * sign
  return {
    fen,
    depth: Number(depth[1]),
    cp: score[1] === 'cp' ? value : null,
    mate: score[1] === 'mate' ? value : null,
    ...toSan(fen, pv[1].trim().split(/\s+/)),
  }
}

/**
 * Runs Stockfish in a web worker and analyses `fen` whenever it changes.
 * Pass null to switch the engine off. The engine runs entirely in the browser.
 */
export function useEngine(fen: string | null): { info: EngineInfo | null; status: EngineStatus } {
  const [info, setInfo] = useState<EngineInfo | null>(null)
  // Set only from worker callbacks: has the engine finished starting, or failed to?
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const worker = useRef<Worker | null>(null)
  // The position being searched now, and the one waiting for that search to stop.
  const searching = useRef<string | null>(null)
  const queued = useRef<string | null>(null)
  const ready = useRef(false)
  const enabled = fen !== null

  // Start the worker when the engine is switched on; shut it down when switched off.
  useEffect(() => {
    if (!enabled) return
    let engine: Worker
    try {
      engine = new Worker(ENGINE_URL)
    } catch {
      const timer = setTimeout(() => setPhase('error'), 0)
      return () => clearTimeout(timer)
    }
    worker.current = engine

    const start = (position: string) => {
      searching.current = position
      engine.postMessage(`position fen ${position}`)
      engine.postMessage(`go depth ${DEPTH}`)
    }
    const startQueued = () => {
      const next = queued.current
      queued.current = null
      if (next) start(next)
      return next !== null
    }

    engine.onmessage = (event: MessageEvent) => {
      const text = String(event.data)
      if (text === 'uciok') {
        engine.postMessage('isready')
      } else if (text === 'readyok') {
        ready.current = true
        setPhase('ready')
        startQueued()
      } else if (text.startsWith('info') && searching.current && !queued.current) {
        const parsed = parseInfo(text, searching.current)
        if (parsed) setInfo({ ...parsed, done: false })
      } else if (text.startsWith('bestmove')) {
        const finished = searching.current
        searching.current = null
        // A queued position means this search was interrupted; otherwise it ran to the end.
        if (!startQueued()) setInfo((current) => (current && current.fen === finished ? { ...current, done: true } : current))
      }
    }
    engine.onerror = () => setPhase('error')
    engine.postMessage('uci')

    return () => {
      engine.terminate()
      worker.current = null
      searching.current = null
      queued.current = null
      ready.current = false
    }
  }, [enabled])

  // New position: stop whatever is running and search this one next.
  useEffect(() => {
    const engine = worker.current
    if (!engine || !fen) return
    queued.current = fen
    if (searching.current) {
      engine.postMessage('stop') // Its "bestmove" reply starts the queued search.
    } else if (ready.current) {
      queued.current = null
      searching.current = fen
      engine.postMessage(`position fen ${fen}`)
      engine.postMessage(`go depth ${DEPTH}`)
    }
  }, [fen])

  // Only report an evaluation that belongs to the position on the board.
  const current = info && info.fen === fen ? info : null
  let status: EngineStatus = 'thinking'
  if (!enabled) status = 'off'
  else if (phase !== 'ready') status = phase
  else if (current?.done) status = 'done'
  return { info: current, status }
}

/** "+0.4", "-1.2", "M5" or "-M3". */
export function formatScore(info: Pick<EngineInfo, 'cp' | 'mate'>): string {
  if (info.mate !== null) return `${info.mate < 0 ? '-' : ''}M${Math.abs(info.mate)}`
  const pawns = (info.cp ?? 0) / 100
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`
}

/** White's share of the evaluation bar, 0 to 100. A one-pawn edge is roughly 60. */
export function whiteShare(info: Pick<EngineInfo, 'cp' | 'mate'>): number {
  if (info.mate !== null) return info.mate > 0 ? 100 : 0
  const share = 100 / (1 + Math.exp(-0.004 * (info.cp ?? 0)))
  return Math.max(3, Math.min(97, share))
}
