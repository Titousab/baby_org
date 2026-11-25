import { expect, type Page, test } from '@playwright/test';
import { goNextWeek, signIn, signOut } from './helpers';

const gapStatus = (page: Page) => page.locator('.cover-row .status');
const dayRow = (page: Page, dow: string) => page.locator('li.day').filter({ has: page.locator('.day-name', { hasText: dow }) });

test('planning a week: add, fill a gap, copy the week, mark a day off', async ({ page }) => {
  await signIn(page);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Calendar' }).click();
  await page.getByRole('navigation', { name: 'Calendar views' }).getByRole('link', { name: 'Caretakers' }).click();
  await expect(page).toHaveURL(/\/calendar\/caretakers/);

  // Next week starts empty
  await goNextWeek(page);
  await expect(page.locator('.pillnav-label b')).toHaveText('Next week');
  await expect(page.getByText('Nothing planned yet')).toBeVisible();

  // Add Dad on Monday 8–4
  await page.getByRole('button', { name: 'Or add one shift' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByText('Dad', { exact: true }).click();
  await sheet.locator('.opt span', { hasText: /^Mon / }).click();
  await sheet.getByLabel('Starts').fill('08:00');
  await sheet.getByLabel('Ends').fill('16:00');
  await sheet.getByRole('button', { name: 'Save shift' }).click();

  const monday = dayRow(page, 'Mon');
  await expect(monday).toContainText('Dad');
  await expect(monday).toContainText('8:00 am – 4:00 pm');
  await expect(monday).toContainText('8h');
  await expect(monday.locator('.gap-row')).toContainText('Nobody 4:00 – 6:30 pm');
  await expect(gapStatus(page)).toHaveText('5 gaps to fill');

  // Fill the gap: the sheet arrives with the gap's times
  await monday.getByRole('button', { name: 'Fill' }).click();
  await expect(page.getByRole('dialog').getByLabel('Starts')).toHaveValue('16:00');
  await expect(page.getByRole('dialog').getByLabel('Ends')).toHaveValue('18:30');
  await page.getByRole('dialog').getByText('Dad', { exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save shift' }).click();
  await expect(monday.locator('.gap-row')).toHaveCount(0);
  await expect(gapStatus(page)).toHaveText('4 gaps to fill');

  // Copy this week to the next
  await page.getByRole('button', { name: 'Copy week' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Copy schedule' }).click();
  await expect(page.getByText(/^Copied to /)).toBeVisible();
  await goNextWeek(page);
  await expect(dayRow(page, 'Mon')).toContainText('8:00 am – 4:00 pm');
  await expect(dayRow(page, 'Mon')).toContainText('4:00 – 6:30 pm');

  // A day off removes its gap
  await expect(gapStatus(page)).toHaveText('4 gaps to fill');
  await page.getByRole('button', { name: /^Day options for Tue/ }).click();
  await page.getByRole('dialog').getByLabel('Mark as a day off').fill('Thanksgiving');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(dayRow(page, 'Tue')).toContainText('Thanksgiving · day off');
  await expect(gapStatus(page)).toHaveText('3 gaps to fill');
});

test('Today shows who is with Ezra and links to the schedule', async ({ page }) => {
  await signIn(page);
  const card = page.getByRole('link', { name: /With Ezra now/ });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/\/calendar\/caretakers/);
});

test("Juju's House is ready to pick, and someone new can be added from the shift sheet", async ({ page }) => {
  await signIn(page);
  await page.goto('/calendar/caretakers');
  for (let i = 0; i < 3; i++) await goNextWeek(page);
  await expect(page.getByText('Nothing planned yet')).toBeVisible();

  await page.getByRole('button', { name: 'Or add one shift' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText("Juju's House", { exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: '+ Someone new' }).click();
  await sheet.getByLabel('Their name').fill('Sitter Ana');
  await sheet.locator('.opt span', { hasText: /^Wed / }).click();
  await sheet.getByRole('button', { name: 'Save shift' }).click();
  await expect(dayRow(page, 'Wed')).toContainText('Sitter Ana');
});

test('a caretaker sees the schedule but cannot change it', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Family and account' }).click();
  await page.getByRole('button', { name: 'Add someone' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add someone' });
  await sheet.getByLabel('Name').fill('Selina');
  await sheet.getByLabel('Email').fill('selina.view@test.local');
  await sheet.getByText('Caretaker', { exact: true }).click();
  await sheet.getByLabel('Starting password').fill('starter-pass-1');
  await sheet.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Selina can sign in now.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await signOut(page);

  await signIn(page, 'selina.view@test.local', 'starter-pass-1');
  await page.goto('/calendar/caretakers');
  // Next week was planned by the first test: it has shifts and gaps, so family would see edit controls here.
  await goNextWeek(page);
  await expect(page.locator('.pillnav-label b')).toHaveText('Next week');
  await expect(page.locator('li.day .shift').first()).toBeVisible();
  await expect(page.locator('.gap-row').first()).toBeVisible();
  await expect(page.locator('button.shift')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add shift' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copy week' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Fill' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Day options/ })).toHaveCount(0);
});

test('copying one day onto other days of the week', async ({ page }) => {
  await signIn(page);
  await page.goto('/calendar/caretakers');
  for (let i = 0; i < 4; i++) await goNextWeek(page);
  await expect(page.getByText('Nothing planned yet')).toBeVisible();

  await page.getByRole('button', { name: 'Or add one shift' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByText('Dad', { exact: true }).click();
  await sheet.locator('.opt span', { hasText: /^Mon / }).click();
  await sheet.getByLabel('Starts').fill('08:00');
  await sheet.getByLabel('Ends').fill('16:00');
  await sheet.getByRole('button', { name: 'Save shift' }).click();
  await expect(dayRow(page, 'Mon')).toContainText('8:00 am – 4:00 pm');

  // An empty day offers no copy
  await page.getByRole('button', { name: /^Day options for Tue/ }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Copy day' })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  // Picking nothing is refused
  await page.getByRole('button', { name: /^Day options for Mon/ }).click();
  const day = page.getByRole('dialog');
  await day.getByRole('button', { name: 'Copy day' }).click();
  await expect(day.getByText('Pick at least one day.')).toBeVisible();

  await day.getByRole('checkbox', { name: /^Wed/ }).check();
  await day.getByRole('checkbox', { name: /^Thu/ }).check();
  await day.getByRole('button', { name: 'Copy day' }).click();
  await expect(page.getByText('Copied Mon to Wed and Thu')).toBeVisible();
  await expect(dayRow(page, 'Wed')).toContainText('8:00 am – 4:00 pm');
  await expect(dayRow(page, 'Thu')).toContainText('8:00 am – 4:00 pm');
  await expect(dayRow(page, 'Tue')).not.toContainText('Dad');

  // A day that now has shifts warns before being replaced
  await page.getByRole('button', { name: /^Day options for Mon/ }).click();
  await expect(page.getByRole('dialog').getByRole('checkbox', { name: /^Wed/ })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('has 1 shift · will be replaced');
});
