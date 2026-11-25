import { expect, test } from '@playwright/test';
import { signIn, signOut } from './helpers';

test('family manage people and settings; caretakers manage only their password', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Family and account' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.locator('.people')).toContainText('Dad');
  await expect(sheet.locator('.people')).toContainText("Juju's House");

  // Add Selina as a caretaker
  await sheet.getByRole('button', { name: 'Add someone' }).click();
  const add = page.getByRole('dialog', { name: 'Add someone' });
  await add.getByLabel('Name').fill('Selina');
  await add.getByLabel('Email').fill('selina@test.local');
  await add.getByText('Caretaker', { exact: true }).click();
  await add.getByLabel('Starting password').fill('starter-pass-1');
  await add.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Selina can sign in now.')).toBeVisible();
  const selinaRow = page.getByRole('dialog').locator('.people li', { hasText: 'Selina' });
  await expect(selinaRow).toContainText('Caretaker');

  // Settings are saved
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel("Ezra's birthday").fill('2025-06-10');
  await dialog.getByLabel('Until').fill('18:00');
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Family and account' }).click();
  await expect(page.getByRole('dialog').getByLabel("Ezra's birthday")).toHaveValue('2025-06-10');
  await expect(page.getByRole('dialog').getByLabel('Until')).toHaveValue('18:00');
  // Put the window back for the other tests
  await page.getByRole('dialog').getByLabel('Until').fill('18:30');
  await page.getByRole('dialog').getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await signOut(page);

  // Selina's view
  await signIn(page, 'selina@test.local', 'starter-pass-1');
  await page.getByRole('button', { name: 'Family and account' }).click();
  const hers = page.getByRole('dialog');
  await expect(hers.getByText('Put Ezra on your Home Screen')).toBeVisible();
  await expect(hers.getByRole('button', { name: 'Add someone' })).toHaveCount(0);
  await expect(hers.getByRole('button', { name: 'Save settings' })).toHaveCount(0);

  await hers.getByLabel('Current password').fill('starter-pass-1');
  await hers.getByLabel('New password').fill('selina-new-pass');
  await hers.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText('Password changed')).toBeVisible();
  await signOut(page);
  await signIn(page, 'selina@test.local', 'selina-new-pass');
});
