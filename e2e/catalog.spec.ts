import { expect, test } from '@playwright/test'
import { boardPieces, playDrillLine } from './helpers.ts'

// These tests rely on the seeded official courses (npm run db:seed).
const cards = '[data-testid=course-card]'

test('the home page lists the official courses with board thumbnails', async ({ page }) => {
  await page.goto('/')
  const london = page.locator(cards).filter({ hasText: 'London System' })
  await expect(london).toBeVisible()
  await expect(london.locator('[data-square]')).toHaveCount(64)
  await expect(london).toContainText('60 lines')
  await expect(london).toContainText('by OpeningDrill')
})

test('filters and search narrow the catalog', async ({ page }) => {
  await page.goto('/openings')
  await expect(page.locator(cards).first()).toBeVisible()
  const titles = () => page.locator(`${cards} h3`).allInnerTexts()

  await page.selectOption('select[aria-label="Source"]', 'false')
  await page.selectOption('select[aria-label="Side"]', 'black')
  await expect.poll(async () => (await titles()).sort()).toEqual(['Caro-Kann', "Queen's Gambit Declined"])

  await page.selectOption('select[aria-label="First move"]', 'e4')
  await expect.poll(titles).toEqual(['Caro-Kann'])

  await page.getByRole('button', { name: 'Clear' }).click()
  await page.fill('input[type=search]', 'vienna')
  await expect.poll(titles).toEqual(['Vienna Game'])

  await page.fill('input[type=search]', 'no such opening anywhere')
  await expect(page.getByTestId('no-courses')).toHaveText('No courses match these filters.')
})

test('a course page shows its lines and links each to the analysis board', async ({ page }) => {
  await page.goto('/')
  await page.locator(cards).filter({ hasText: 'London System' }).click()
  await expect(page).toHaveURL(/\/course\/london-system$/)
  await expect(page.getByRole('heading', { name: 'London System' })).toBeVisible()
  await expect(page.locator('[data-testid=line-list] li')).toHaveCount(60)
  await expect(page.getByRole('link', { name: 'Sign up to enroll' })).toBeVisible()

  const api = await (await page.request.get('/api/courses/london-system')).json()
  await page.locator('[data-testid=line-list] li').first().getByRole('link', { name: 'View position' }).click()
  await expect.poll(() => boardPieces(page)).toBe(api.lines[0].finalFen.split(' ')[0])
})

test('an unknown course shows a not-found page', async ({ page }) => {
  await page.goto('/course/does-not-exist')
  await expect(page.getByText('Course not found')).toBeVisible()
})

test('a guest can play the first line and is then invited to sign up', async ({ page }) => {
  const { course, line } = await (await page.request.get('/api/courses/caro-kann/first-line')).json()
  expect(course.side).toBe('BLACK')

  await page.goto('/course/caro-kann')
  await page.getByRole('link', { name: 'Try the first line' }).click()
  await expect(page.getByTestId('drill')).toBeVisible()
  // Black course: the opponent opens. Our reply stays hidden until we ask for a hint.
  await expect(page.getByTestId('drill-prompt')).toHaveText('Your move. What do you play here?')
  await expect(page.locator('[data-testid=board] svg [marker-end]')).toHaveCount(0)
  await page.getByTestId('hint-button').click()
  await expect(page.getByTestId('drill-prompt')).toHaveText(`The move is 1... ${line.moves[1]}. Play it to continue.`)
  await expect(page.getByTestId('hint-button')).toHaveCount(0)

  await playDrillLine(page, line.moves, 'BLACK')
  await expect(page.getByTestId('line-summary')).toContainText('First line done!')
  await expect(page.getByTestId('line-summary')).toContainText(/0\s*mistakes/)
  await expect(page.getByTestId('signup-prompt')).toBeVisible()

  await page.getByTestId('open-analysis').click()
  await expect.poll(() => boardPieces(page)).toBe(line.finalFen.split(' ')[0])
})

test('pages do not scroll sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  for (const path of ['/', '/course/london-system', '/analysis', '/community', '/leaderboards', '/login']) {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
    await page.waitForTimeout(800) // let cards and boards finish laying out
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0)
  }
})
