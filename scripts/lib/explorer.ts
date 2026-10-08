import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Chess } from 'chess.js'

export type ExplorerMove = { uci: string; san: string; white: number; draws: number; black: number }
export type ExplorerResponse = {
  white: number
  draws: number
  black: number
  moves: ExplorerMove[]
  opening: { eco: string; name: string } | null
}

/**
 * The three data sets the generator reads:
 *  - masters: over-the-board master games (picks the user's moves)
 *  - strong:  Lichess games rated 2200+ (fallback when masters has no data)
 *  - club:    Lichess games rated 1400-2000 (decides which replies to prepare for)
 */
export type Db = 'masters' | 'strong' | 'club'

export interface Explorer {
  /** `play` is the full move list in UCI from the standard starting position. */
  query(db: Db, play: string[]): Promise<ExplorerResponse>
}

export const gamesOf = (m: { white: number; draws: number; black: number }) => m.white + m.draws + m.black

const HOST = 'https://explorer.lichess.org'
const LICHESS_PARAMS = 'variant=standard&speeds=blitz,rapid,classical'

function urlFor(db: Db, play: string[]): string {
  const moves = `play=${play.join(',')}`
  if (db === 'masters') return `${HOST}/masters?${moves}`
  const ratings = db === 'strong' ? '2200,2500' : '1400,1600,1800,2000'
  return `${HOST}/lichess?${LICHESS_PARAMS}&ratings=${ratings}&${moves}`
}

// Lichess writes castling as "king takes own rook" (e1h1); chess.js wants the king's destination (e1g1).
const CASTLING: Record<string, string> = { e1h1: 'e1g1', e1a1: 'e1c1', e8h8: 'e8g8', e8a8: 'e8c8' }

function applyUci(chess: Chess, uci: string): void {
  const move = (u: string) => chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })
  try {
    move(uci)
  } catch (err) {
    const castle = CASTLING[uci]
    if (!castle) throw err
    move(castle)
  }
}

/** Cache key for the position itself, so different move orders reaching it share one answer. */
function positionKey(db: Db, play: string[]): string {
  const chess = new Chess()
  for (const uci of play) applyUci(chess, uci)
  // Drop the move counters: they differ between move orders but do not change the position.
  return `${db}|${chess.fen().split(' ').slice(0, 4).join(' ')}`
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Options = {
  token: string | undefined
  cacheDir: string
  /** Pause between live requests. Lichess asks for one request at a time. */
  delayMs?: number
  log?: (message: string) => void
}

/** Explorer backed by the Lichess API, with every response cached on disk. */
export function createLichessExplorer({ token, cacheDir, delayMs = 2700, log = () => {} }: Options): Explorer & {
  stats: { cached: number; fetched: number }
} {
  const stats = { cached: 0, fetched: 0 }

  async function fetchLive(url: string): Promise<ExplorerResponse> {
    if (!token) {
      throw new Error(
        'LICHESS_TOKEN is not set. The Lichess opening explorer requires a token.\n' +
          'Create one (no scopes needed) at https://lichess.org/account/oauth/token and add\n' +
          'LICHESS_TOKEN=... to server/.env',
      )
    }
    for (let attempt = 1; attempt <= 30; attempt++) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      if (res.status === 429) {
        log(`Rate limited by Lichess. Waiting 60s (attempt ${attempt} of 30)...`)
        await sleep(60_000)
        continue
      }
      if (res.status === 401) throw new Error('Lichess rejected the token (HTTP 401). Check LICHESS_TOKEN.')
      if (!res.ok) throw new Error(`Lichess explorer returned HTTP ${res.status} for ${url}`)
      return (await res.json()) as ExplorerResponse
    }
    throw new Error('Still rate limited by Lichess after 30 attempts. Try again later.')
  }

  return {
    stats,
    async query(db, play) {
      const url = urlFor(db, play)
      const fileFor = (key: string) => path.join(cacheDir, `${createHash('sha1').update(key).digest('hex')}.json`)
      // Two cache entries per answer: by exact move order, and by resulting position.
      const files = [fileFor(url), fileFor(positionKey(db, play))]
      for (const file of files) {
        try {
          const cached = JSON.parse(await readFile(file, 'utf8')) as ExplorerResponse
          stats.cached++
          return cached
        } catch {
          // Not cached under this key.
        }
      }
      const started = Date.now()
      const data = await fetchLive(url)
      stats.fetched++
      if (stats.fetched % 25 === 0) log(`${stats.fetched} requests so far (last one took ${Date.now() - started} ms)`)
      await mkdir(cacheDir, { recursive: true })
      for (const file of files) await writeFile(file, JSON.stringify(data))
      await sleep(delayMs)
      return data
    },
  }
}
