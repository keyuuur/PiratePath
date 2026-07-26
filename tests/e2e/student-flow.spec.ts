import { expect, test } from '@playwright/test'

async function fillMeasurements(
  page: import('@playwright/test').Page,
  distance: string,
  magnitude: string,
  direction: 'North' | 'East' | 'South' | 'West' | 'None',
) {
  await page.getByLabel('Distance in meters').fill(distance)
  await page.getByLabel('Displacement magnitude in meters').fill(magnitude)
  await page.getByRole('radio', { name: new RegExp(`^${direction}`) }).check()
}

async function addMoves(
  page: import('@playwright/test').Page,
  direction: 'North' | 'East' | 'South' | 'West',
  count: number,
) {
  const button = page.getByRole('button', { name: `Add one meter ${direction}` })
  for (let index = 0; index < count; index += 1) await button.click()
}

async function completeGuidedAnswer(page: import('@playwright/test').Page, placeVector = false) {
  if (placeVector) {
    await page.getByRole('button', { name: /Tap START/ }).click()
    await page.getByRole('button', { name: /Tap FINISH/ }).click()
  }
  await fillMeasurements(page, '0', '0', 'None')
  await page.getByRole('button', { name: 'Check practice answer' }).click()
  await expect(page.getByText(/Try again/)).toBeVisible()
  await page.getByRole('button', { name: 'Check practice answer' }).click()

  const worked = page.locator('.worked-panel')
  await expect(worked).toBeVisible()
  const text = await worked.innerText()
  const distance = text.match(/Distance:[\s\S]*?= (\d+) m/)?.[1]
  const displacement = text.match(/Displacement:[\s\S]*?= (\d+) m (north|east|south|west|none)/i)
  expect(distance).toBeTruthy()
  expect(displacement).toBeTruthy()
  const direction = `${displacement![2][0].toUpperCase()}${displacement![2].slice(1).toLowerCase()}` as
    'North' | 'East' | 'South' | 'West' | 'None'
  await fillMeasurements(page, distance!, displacement![1], direction)
  await page.getByRole('button', { name: 'Check practice answer' }).click()
  await expect(page.getByText(/Ready to sail/)).toBeVisible()
  await page.getByRole('button', { name: 'Next practice mission' }).click()
}

test('demo join reaches guided practice without horizontal overflow', async ({ page }) => {
  await page.goto(process.env.PIRATE_PATH_E2E_URL ?? '/')
  await page.getByLabel('First name').fill('Ada')
  await page.getByLabel('Last name').fill('Lovelace')
  await page.getByLabel('Class period').selectOption('2nd hour')
  await page.getByRole('button', { name: 'Join voyage' }).click()
  await expect(page.getByRole('heading', { name: /Two measurements/ })).toBeVisible()
  await page.getByRole('button', { name: 'Begin guided practice' }).click()
  await expect(page.getByRole('heading', { name: /P1: Trace and Count/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Correctness is shown only after final submission.')).toHaveCount(0)
  await expect(page.locator('.map-card .sr-only')).toContainText(/Start at|pirate starts/i)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
  const undersizedButtons = await page.locator('button:visible').evaluateAll((buttons) => buttons
    .filter((button) => button.getBoundingClientRect().width < 48 || button.getBoundingClientRect().height < 48)
    .map((button) => ({ label: button.textContent?.trim(), box: button.getBoundingClientRect().toJSON() })))
  expect(undersizedButtons).toEqual([])
})

test('keyboard-only join remains usable at 200% text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'ipad-portrait', 'The enlarged-text keyboard flow runs once on the portrait target.')
  await page.goto('/')
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  await page.getByLabel('First name').focus()
  await page.keyboard.type('Ada')
  await page.keyboard.press('Tab')
  await page.keyboard.type('Lovelace')
  await page.keyboard.press('Tab')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: /Two measurements/ })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('complete demo voyage with guided correction, neutral assessment, review, and results', async ({ page }, testInfo) => {
  test.setTimeout(300_000)
  test.skip(testInfo.project.name !== 'chromebook', 'The full journey runs once; iPad projects run responsive smoke coverage.')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByLabel('First name').fill('Ada')
  await page.getByLabel('Last name').fill('Lovelace')
  await page.getByLabel('Class period').selectOption('2nd hour')
  await page.getByRole('button', { name: 'Join voyage' }).click()
  await page.getByRole('button', { name: 'Begin guided practice' }).click()

  await expect(page.getByRole('heading', { name: /P1: Trace and Count/ })).toBeVisible({ timeout: 15_000 })
  await completeGuidedAnswer(page)
  await expect(page.getByRole('heading', { name: /P2: Place the Vector/ })).toBeVisible()
  await completeGuidedAnswer(page, true)

  await expect(page.getByRole('heading', { name: /P3: Plan, Predict, Launch/ })).toBeVisible()
  const startingPosition = await page.locator('.map-card .sr-only').innerText()
  if (startingPosition.includes('column 1')) {
    await addMoves(page, 'North', 2)
    await addMoves(page, 'East', 5)
    await addMoves(page, 'South', 2)
  } else {
    await addMoves(page, 'South', 2)
    await addMoves(page, 'West', 5)
    await addMoves(page, 'North', 2)
  }
  await completeGuidedAnswer(page)

  await page.getByRole('button', { name: 'Begin scored voyage' }).click()
  for (const id of ['A1', 'A2', 'A3']) {
    await expect(page.getByRole('heading', { name: new RegExp(`${id}:`) })).toBeVisible()
    await fillMeasurements(page, '0', '0', 'None')
    await page.getByRole('button', { name: 'Save and continue' }).click()
  }

  await expect(page.getByRole('heading', { name: /A4:/ })).toBeVisible()
  await addMoves(page, 'North', 2)
  await addMoves(page, 'East', 5)
  await addMoves(page, 'South', 2)
  await fillMeasurements(page, '9', '5', 'East')
  await page.getByRole('button', { name: 'Save and continue' }).click()

  await expect(page.getByRole('heading', { name: /A5:/ })).toBeVisible()
  await addMoves(page, 'North', 2)
  await addMoves(page, 'East', 6)
  await addMoves(page, 'South', 2)
  await fillMeasurements(page, '10', '6', 'East')
  await page.getByRole('button', { name: 'Save and continue' }).click()

  await expect(page.getByRole('heading', { name: /Three final concept probes/ })).toBeVisible()
  for (const fieldset of await page.locator('.probe-card').all()) await fieldset.getByRole('radio').first().check()
  await page.getByRole('button', { name: 'Save and review all responses' }).click()
  await expect(page.getByRole('heading', { name: /Check before final submission/ })).toBeVisible()
  await expect(page.getByText(/Correct measurements/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Final Submit' }).click()
  await expect(page.getByRole('heading', { name: /Nice work, Ada/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Not scored')).toBeVisible()
  await expect(page.getByText(/not sent to a teacher/i)).toBeVisible()
})
