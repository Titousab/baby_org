import { expect, type Page } from '@playwright/test';

export const OWNER = { name: 'Dad', email: 'dad@test.local', password: 'test-pass-123' };

export async function signIn(page: Page, email = OWNER.email, password = OWNER.password) {
  await page.goto('/signin');
  await page.getByLabel('Your email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // The dev server may compile the Today page on first visit.
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
}

export async function signOut(page: Page) {
  // Use the account sheet if it's already open; otherwise open it.
  if (!(await page.getByRole('dialog').count())) await page.getByRole('button', { name: 'Family and account' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/signin$/);
}

/** Go one week forward on the schedule and wait for the new week to show. */
export async function goNextWeek(page: Page) {
  const range = page.locator('.pillnav-label span');
  const before = await range.textContent();
  await page.getByLabel('Next week').click();
  await expect(range).not.toHaveText(before ?? '');
}
