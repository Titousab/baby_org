import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('logging, editing and removing things on Today', async ({ page }) => {
  await signIn(page);
  await expect(page.getByText('0 of 6 logged')).toBeVisible();

  // A meal
  await page.getByRole('button', { name: 'Add Breakfast' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('What did he eat?').fill('Oatmeal');
  await sheet.getByText('Some', { exact: true }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Breakfast saved. Everyone can see it now.')).toBeVisible();
  const breakfast = page.getByRole('button', { name: /^Breakfast/ });
  await expect(breakfast).toContainText('Oatmeal');
  await expect(breakfast).toContainText('ate some');
  await expect(breakfast).toContainText('Dad');
  await expect(page.getByText('1 of 6 logged')).toBeVisible();

  // Remove it again
  await breakfast.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('button', { name: 'Add Breakfast' })).toBeVisible();
  await expect(page.getByText('0 of 6 logged')).toBeVisible();

  // A nap, with its length shown before saving
  await page.getByRole('button', { name: 'Add Nap' }).click();
  await page.getByRole('dialog').getByLabel('Fell asleep').fill('13:00');
  await page.getByRole('dialog').getByLabel('Woke up').fill('14:30');
  await expect(page.getByRole('dialog').getByText('Slept 1h 30m')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  const napTile = page.getByRole('button', { name: /^Nap/ });
  await expect(napTile).toContainText('1h 30m');
  await expect(page.getByText('Napped 1h 30m')).toBeVisible();

  // A second nap the same day
  await napTile.click();
  await expect(page.getByRole('dialog')).toContainText('1:00 – 2:30 pm');
  await page.getByRole('dialog').getByRole('button', { name: 'Add another nap' }).click();
  await page.getByRole('dialog').getByLabel('Fell asleep').fill('16:00');
  await page.getByRole('dialog').getByLabel('Woke up').fill('16:30');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(napTile).toContainText('2h');
  await expect(napTile).toContainText('2 naps');
  await expect(page.getByText('Napped 2h')).toBeVisible();

  // Something else
  await page.getByRole('button', { name: 'Add something else' }).click();
  await page.getByRole('dialog').getByText('Milestone', { exact: true }).click();
  await page.getByRole('dialog').getByLabel('Details').fill('Said truck');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  const notes = page.getByRole('list', { name: 'Anything else' });
  await expect(notes).toContainText('Said truck');
  await expect(notes).toContainText('Milestone');

  // A meal without food is explained, not saved
  await page.getByRole('button', { name: 'Add Lunch' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog').getByText('Write what he ate, like "banana and yogurt".')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('moving between days', async ({ page }) => {
  await signIn(page);
  await expect(page.getByLabel('Next day')).toHaveAttribute('aria-disabled', 'true');
  await page.getByLabel('Previous day').click();
  await expect(page.locator('.pillnav-label b')).toHaveText('Yesterday');
  await page.getByLabel('Next day').click();
  await expect(page.locator('.pillnav-label b')).toHaveText('Today');
});
