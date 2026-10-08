import { expect, test } from '@playwright/test'
import { clickMove, createCourse, enroll, playDrillLine, signUp, SMALL_LINES, SMALL_PGN, sql } from './helpers.ts'

/** Makes every card of this user due now, most overdue first in line order. */
async function makeAllDue(username: string) {
  await sql(
    `UPDATE "Card" c SET due = now() - make_interval(hours => 100 - l."order"), "lastReview" = now() - interval '5 days'
     FROM "Line" l, "User" u
     WHERE l.id = c."lineId" AND u.id = c."userId" AND u.username = $1`,
    [username],
  )
}

test('learn mode: hints, a wrong move, comments, and a saved session', async ({ page }) => {
  await signUp(page, 'lrn')
  const course = await createCourse(page.request, { title: 'PW Learn Course', side: 'WHITE', pgn: SMALL_PGN })
  expect(course.lines).toHaveLength(3)

  // Not enrolled yet.
  await page.goto(`/train/learn/${course.id}`)
  await expect(page.getByText('Enroll in this course first.')).toBeVisible()

  await page.goto(`/course/${course.slug}`)
  await page.getByRole('button', { name: 'Enroll' }).click()
  await expect(page.getByTestId('enrolled')).toBeVisible()
  await page.getByRole('link', { name: 'Learn new lines' }).click()

  await expect(page.getByTestId('session-progress')).toHaveText('New line 1 of 3')
  await expect(page.getByTestId('drill-prompt')).toHaveText('Your move: 1. d4')
  await expect(page.getByTestId('drill-comment')).toHaveText('Claim the centre.')

  await clickMove(page, 'e2', 'e4') // wrong
  await expect(page.getByTestId('drill')).toHaveAttribute('data-ply', '0')
  await expect(page.getByTestId('drill-wrong')).toBeVisible()

  await playDrillLine(page, SMALL_LINES.nf6, 'WHITE')
  const summary = page.getByTestId('line-summary')
  await expect(summary).toContainText('Line learned')
  await expect(summary).toContainText(/1\s*mistake/)
  await expect(page.getByTestId('xp-earned')).toHaveText('+5 XP')

  await page.getByRole('button', { name: 'Next line' }).click()
  await expect(page.getByTestId('session-progress')).toHaveText('New line 2 of 3')
  await playDrillLine(page, SMALL_LINES.c5, 'WHITE')
  await expect(page.getByTestId('move-list')).toHaveCount(0) // drill replaced by the summary
  await page.getByRole('button', { name: 'Next line' }).click()
  await playDrillLine(page, SMALL_LINES.e6, 'WHITE')
  await expect(summary).toContainText('Session complete!')
  await expect(summary).toContainText('every line in this course')

  await page.goto(`/train/learn/${course.id}`)
  await expect(page.getByText('Course complete')).toBeVisible()
})

test('the daily limit caps how many new lines are offered', async ({ page }) => {
  await signUp(page, 'lim')
  const course = await createCourse(page.request, { title: 'PW Limit Course', side: 'WHITE', pgn: SMALL_PGN })
  await enroll(page.request, course.id)
  for (const line of course.lines.slice(0, 2)) await page.request.post('/api/train/learned', { data: { lineId: line.id } })

  const london = await (await page.request.get('/api/courses/london-system')).json()
  await enroll(page.request, london.course.id)
  const session = await (await page.request.get(`/api/train/learn/${london.course.id}`)).json()
  expect(session.learnedToday).toBe(2)
  expect(session.lines).toHaveLength(3) // five a day, two already used
  expect(session.newInCourse).toBe(60)
})

test('review mode: no hints, a miss reveals the move, grades and XP are saved', async ({ page }) => {
  const user = await signUp(page, 'rev')
  const course = await createCourse(page.request, { title: 'PW Review Course', side: 'WHITE', pgn: SMALL_PGN })
  await enroll(page.request, course.id)
  for (const line of course.lines.slice(0, 2)) await page.request.post('/api/train/learned', { data: { lineId: line.id } })

  await page.goto('/train/review')
  await expect(page.getByText('Nothing due right now')).toBeVisible()

  await makeAllDue(user.name)
  await page.goto('/train/review')
  await expect(page.getByTestId('session-progress')).toHaveText('Line 1 of 2')
  await expect(page.getByTestId('drill-prompt')).toHaveText('Your move. What do you play here?')
  await expect(page.getByTestId('drill-comment')).toHaveCount(0)

  // Line 1: clean and quick.
  await playDrillLine(page, course.lines[0].moves, 'WHITE')
  await expect(page.getByTestId('line-summary')).toContainText('Remembered')
  await expect(page.getByTestId('review-outcome')).toContainText(/Grade: (Easy|Good)\. Next review in \d+ days\./)
  await expect(page.getByTestId('xp-earned')).toHaveText(/^\+1[02] XP$/)

  // Line 2: one wrong move.
  await page.getByRole('button', { name: 'Next line' }).click()
  await expect(page.getByTestId('session-progress')).toHaveText('Line 2 of 2')
  await clickMove(page, 'e2', 'e4')
  await expect(page.getByTestId('drill-prompt')).toHaveText('The move was 1. d4. Play it to continue.')
  await clickMove(page, 'g1', 'f3') // a second miss on the same move still counts once
  await expect(page.getByTestId('drill')).toHaveAttribute('data-mistakes', '1')
  await playDrillLine(page, course.lines[1].moves, 'WHITE')
  await expect(page.getByTestId('line-summary')).toContainText('Review complete!')
  await expect(page.getByTestId('review-outcome')).toContainText('Grade: Again. Next review tomorrow.')
  await expect(page.getByTestId('xp-earned')).toHaveText('+4 XP')
  await expect(page.getByTestId('session-total')).toContainText('1 of 2 lines from memory.')

  const rows = await sql<{ rating: number; lapses: number }>(
    `SELECT r.rating, c.lapses FROM "ReviewLog" r JOIN "User" u ON u.id = r."userId"
     JOIN "Card" c ON c."userId" = r."userId" AND c."lineId" = r."lineId"
     WHERE u.username = $1 AND r.rating > 0 ORDER BY r."reviewedAt"`,
    [user.name],
  )
  expect(rows.map((r) => r.rating)).toEqual([expect.any(Number), 1])
  expect(rows[0].rating).toBeGreaterThanOrEqual(3)
  expect(rows[1].lapses).toBe(1)

  await page.goto('/train/review')
  await expect(page.getByText('Nothing due right now')).toBeVisible()
})

test('the dashboard reflects learned, due and mastered lines, streak and activity', async ({ page }) => {
  const user = await signUp(page, 'dash')
  await page.goto('/dashboard')
  await expect(page.getByTestId('dashboard-empty')).toBeVisible()

  const course = await createCourse(page.request, { title: 'PW Dash Course', side: 'WHITE', pgn: SMALL_PGN })
  await enroll(page.request, course.id)
  for (const line of course.lines.slice(0, 2)) await page.request.post('/api/train/learned', { data: { lineId: line.id } })
  // One line mastered and not due; the other due now. Both learned yesterday.
  await sql(
    `UPDATE "Card" c SET "createdAt" = now() - interval '1 day',
            stability = CASE WHEN l."order" = 1 THEN 30 ELSE c.stability END,
            due = CASE WHEN l."order" = 1 THEN now() + interval '20 days' ELSE now() - interval '1 hour' END
     FROM "Line" l, "User" u WHERE l.id = c."lineId" AND u.id = c."userId" AND u.username = $1`,
    [user.name],
  )

  await page.goto('/dashboard')
  await expect(page.getByTestId('tile-due')).toContainText(/Lines due now\s*1/)
  await expect(page.getByRole('link', { name: 'Review now' })).toBeVisible()
  await expect(page.getByTestId('tile-new')).toContainText(/New lines available\s*1/)
  await expect(page.getByTestId('tile-mastered')).toContainText('33%')
  await expect(page.getByTestId('tile-mastered')).toContainText('1 of 3 lines')
  await expect(page.getByTestId('tile-streak')).toContainText(/Current streak\s*1\s*day/)
  await expect(page.getByTestId('total-xp')).toContainText('10 XP')
  await expect(page.locator('[data-testid=heatmap] button')).toHaveCount(84)
  await expect(page.getByTestId('course-progress')).toContainText('2 of 3 learned · 1 mastered · 1 due')

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  await page.hover(`[data-date="${yesterday}"]`)
  await expect(page.getByTestId('heatmap-detail')).toContainText('0 reviews, 2 new lines')
})

test('XP puts players on the weekly and all-time leaderboards', async ({ page }) => {
  const user = await signUp(page, 'xp')
  await page.goto('/leaderboards')
  await expect(page.getByTestId('no-xp')).toBeVisible()

  const course = await createCourse(page.request, { title: 'PW XP Course', side: 'WHITE', pgn: SMALL_PGN })
  await enroll(page.request, course.id)
  const learned = await (await page.request.post('/api/train/learned', { data: { lineId: course.lines[0].id } })).json()
  expect(learned).toMatchObject({ xpEarned: 5, totalXp: 5, streak: 1 })
  const again = await (await page.request.post('/api/train/learned', { data: { lineId: course.lines[0].id } })).json()
  expect(again.xpEarned).toBe(0)
  const review = await (
    await page.request.post('/api/train/result', { data: { lineId: course.lines[0].id, mistakes: 0, avgMs: 1000, maxMs: 1500 } })
  ).json()
  expect(review).toMatchObject({ grade: 'EASY', xpEarned: 12, totalXp: 17 })

  for (const period of ['week', 'all']) {
    const board = await (await page.request.get(`/api/leaderboards?period=${period}`)).json()
    expect(board.me).toMatchObject({ xp: 17, username: user.name })
  }

  await page.goto('/leaderboards')
  const mine = page.locator('tr[data-me]')
  await expect(mine).toContainText(user.name)
  await expect(mine).toContainText('17')
  await page.getByRole('tab', { name: 'All time' }).click()
  await expect(page.locator('tr[data-me]')).toContainText('17')
})
