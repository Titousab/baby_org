import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/** Today in New York as YYYY-MM-DD. */
const todayNY = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

/** The 1st of the month, 18 months before today: Ezra is exactly 18 months old all month. */
function birthday18MonthsAgo() {
  const [y, m] = todayNY().split('-').map(Number);
  const total = y * 12 + (m - 1) - 18;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}

test('a hand-typed class: add it, correct its ages, show older-kids classes, delete it', async ({ page }) => {
  await signIn(page);

  // Ezra's birthday drives the age filter
  await page.getByRole('button', { name: 'Family and account' }).click();
  await page.getByRole('dialog').getByLabel("Ezra's birthday").fill(birthday18MonthsAgo());
  await page.getByRole('dialog').getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Calendar' }).click();
  await expect(page).toHaveURL(/\/calendar\/classes/);
  await expect(page.getByText('Ezra is 18 months')).toBeVisible();

  // The places sheet lists the five places, and family can add a class
  await page.getByRole('button', { name: /places connected/ }).click();
  const places = page.getByRole('dialog');
  for (const name of ['Park Slope Library', "Young Ethel's", 'The Bramble', 'Good Day Play Cafe', 'Treasure Trunk Theatre']) {
    await expect(places).toContainText(name);
  }
  await places.getByRole('button', { name: 'Add a class' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Place').selectOption({ label: 'The Bramble' });
  await form.getByLabel('Class name').fill('Test Music Circle');
  await form.getByLabel('First day').fill(todayNY());
  await form.getByLabel('Starts').fill('23:50');
  await form.getByLabel('Length (minutes)').fill('30');
  await form.getByLabel('Youngest (months)').fill('12');
  await form.getByLabel('Oldest (months)').fill('24');
  await form.getByLabel('Price').fill('$25');
  await form.getByRole('button', { name: 'Save class' }).click();
  await expect(page.getByText('Class saved')).toBeVisible();

  const row = page.locator('li.class', { hasText: 'Test Music Circle' });
  await expect(row).toContainText('$25');
  await expect(row).toContainText('The Bramble');
  const book = row.getByRole('link', { name: /Book/ });
  await expect(book).toHaveAttribute('target', '_blank');
  await expect(book).toHaveAttribute('href', 'https://www.thebramble.space/classschedule');

  // Correct its ages: now it's for older kids and hides
  await row.getByRole('button', { name: /Test Music Circle/ }).click();
  await page.getByRole('dialog').getByLabel('Youngest (months)').fill('36');
  await page.getByRole('dialog').getByLabel('Oldest (months)').fill('60');
  await page.getByRole('dialog').getByRole('button', { name: 'Save ages' }).click();
  await expect(page.locator('li.class', { hasText: 'Test Music Circle' })).toHaveCount(0);
  await expect(page.getByText(/for other ages hidden/)).toBeVisible();

  await page.getByRole('button', { name: 'Show' }).click();
  const shown = page.locator('li.class', { hasText: 'Test Music Circle' });
  await expect(shown).toContainText('Older kids');

  // Delete it
  await shown.getByRole('button', { name: /Test Music Circle/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete class' }).click();
  await expect(page.getByText('Class deleted')).toBeVisible();
  await expect(page.locator('li.class', { hasText: 'Test Music Circle' })).toHaveCount(0);
});

test('a caretaker sees the classes but cannot add classes or sync', async ({ page }) => {
  // Selina's viewing account comes from caretakers.spec.ts, which runs first.
  await signIn(page, 'selina.view@test.local', 'starter-pass-1');
  await page.goto('/calendar/classes');
  await page.getByRole('button', { name: /places connected/ }).click();
  await expect(page.getByRole('dialog')).toContainText('The Bramble');
  await expect(page.getByRole('button', { name: 'Add a class' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sync now' })).toHaveCount(0);
});
