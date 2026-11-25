import { expect, test } from '@playwright/test';
import { OWNER, signIn, signOut } from './helpers';

test('signed-out visitors land on the sign-in screen', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole('heading', { name: 'Ezra', exact: true })).toBeVisible();
  await expect(page.getByText('Forgot your password? Ask Dad, Mom or Lauren to reset it.')).toBeVisible();
});

test('a wrong password shows a plain message', async ({ page }) => {
  await page.goto('/signin');
  await page.getByLabel('Your email').fill(OWNER.email);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText("That email and password don't match.")).toBeVisible();
  await expect(page).toHaveURL(/\/signin$/);
});

test('signing in keeps you signed in until you sign out', async ({ page, context }) => {
  await signIn(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Today' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Calendar' })).toBeVisible();

  const cookie = (await context.cookies()).find((c) => c.name === 'ezra_session');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');

  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: "Ezra's day" })).toBeVisible();

  await signOut(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/signin$/);
});
