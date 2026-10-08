import { type APIRequestContext, type Browser, expect, type Page } from '@playwright/test'
import { Chess } from 'chess.js'
import pg from 'pg'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://openingdrill:openingdrill@localhost:5432/openingdrill?schema=public'

/** Runs SQL directly against the test database. Used to move due dates into the past, and to clean up. */
export async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    return (await client.query<T>(text, params)).rows
  } finally {
    await client.end()
  }
}

export type TestUser = { name: string; email: string; password: string }

/** Registers a fresh account through the API. The page's browser context is then signed in. */
export async function signUp(page: Page, tag = 'u'): Promise<TestUser> {
  const name = `pw_${tag}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20)
  const user = { name, email: `${name}@example.com`, password: 'password123' }
  const res = await page.request.post('/api/auth/register', { data: { email: user.email, username: name, password: user.password } })
  expect(res.status(), 'sign-up should succeed').toBe(201)
  return user
}

/** A second, separately signed-in browser session (or a guest, with `tag` null). */
export async function newSession(browser: Browser, tag: string | null): Promise<{ page: Page; user: TestUser | null }> {
  const context = await browser.newContext({ baseURL: 'http://localhost:5173', viewport: { width: 1280, height: 950 } })
  const page = await context.newPage()
  return { page, user: tag ? await signUp(page, tag) : null }
}

export type CreatedCourse = {
  id: string
  slug: string
  lines: { id: string; order: number; name: string; moves: string[]; comments: Record<string, string> }[]
}

/** Creates a private course owned by the signed-in user, from PGN. */
export async function createCourse(
  request: APIRequestContext,
  input: { title: string; side: 'WHITE' | 'BLACK'; pgn: string; pitch?: string },
): Promise<CreatedCourse> {
  const created = await request.post('/api/creator/courses', { data: { title: input.title, side: input.side, pgn: input.pgn } })
  expect(created.status(), 'course creation should succeed').toBe(201)
  const { course } = (await created.json()) as { course: { id: string; slug: string } }
  if (input.pitch) await request.put(`/api/creator/courses/${course.id}`, { data: { pitch: input.pitch } })
  const detail = (await (await request.get(`/api/creator/courses/${course.id}`)).json()) as { lines: CreatedCourse['lines'] }
  return { ...course, lines: detail.lines }
}

export async function enroll(request: APIRequestContext, courseId: string) {
  expect((await request.post(`/api/courses/${courseId}/enroll`)).ok()).toBe(true)
}

export const square = (page: Page, name: string) => page.locator(`[data-square="${name}"]`)

/** Plays a move by clicking its start and end squares. */
export async function clickMove(page: Page, from: string, to: string) {
  await square(page, from).click()
  await page.waitForTimeout(80)
  await square(page, to).click()
  await page.waitForTimeout(120)
}

export async function dragMove(page: Page, from: string, to: string) {
  const a = await square(page, from).boundingBox()
  const b = await square(page, to).boundingBox()
  if (!a || !b) throw new Error(`square ${from} or ${to} is not on screen`)
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(250)
}

export const boardFen = async (page: Page) => (await page.getAttribute('[data-testid=board]', 'data-fen')) ?? ''
export const boardPieces = async (page: Page) => (await boardFen(page)).split(' ')[0]

/** From and to squares of a SAN move after the given moves. */
export function squaresOf(movesBefore: string[], san: string): { from: string; to: string } {
  const chess = new Chess()
  for (const m of movesBefore) chess.move(m)
  const move = chess.move(san)
  return { from: move.from, to: move.to }
}

/**
 * Plays the user's side of a line in a learn or review drill; the app plays the
 * opponent. Stops after the last move, when the drill is replaced by its summary.
 */
export async function playDrillLine(page: Page, moves: string[], side: 'WHITE' | 'BLACK', drill = '[data-testid=drill]') {
  const userParity = side === 'WHITE' ? 0 : 1
  const atLeast = (ply: number) =>
    page.waitForFunction(
      ([selector, target]) => Number(document.querySelector(selector as string)?.getAttribute('data-ply')) >= (target as number),
      [drill, ply] as const,
    )
  for (let ply = 0; ply < moves.length; ply++) {
    if (ply % 2 !== userParity) continue
    await atLeast(ply) // wait for the opponent's move before ours
    const { from, to } = squaresOf(moves.slice(0, ply), moves[ply])
    await clickMove(page, from, to)
  }
}

/** A small White course: two lines with a comment, and a third for publishing rules. */
export const SMALL_PGN = '1. d4 {Claim the centre.} d5 2. Bf4 {Bishop out before e3.} Nf6 (2... c5 3. e3) (2... e6 3. Nf3) 3. e3'
export const SMALL_LINES = {
  nf6: ['d4', 'd5', 'Bf4', 'Nf6', 'e3'],
  c5: ['d4', 'd5', 'Bf4', 'c5', 'e3'],
  e6: ['d4', 'd5', 'Bf4', 'e6', 'Nf3'],
}
