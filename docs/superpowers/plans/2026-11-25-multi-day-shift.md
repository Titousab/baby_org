# Add One Shift on Several Days Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the "Add a shift" sheet, family can tick several days of the week and save once, creating one ordinary shift per day.

**Architecture:** A new `addShifts` repo function validates every day first, then inserts all the shifts in one statement. `saveShiftAction` sends new shifts there, with every `date` value from the form. In `ShiftSheet`, the "Which day?" radios become controlled checkboxes when adding, with a "Weekdays" shortcut. Editing keeps its single-day radios.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, Drizzle ORM over Postgres/PGlite, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-multi-day-shift-design.md`

## Global Constraints

- Work in `c:\Users\asabb\Projects\baby_org` on branch `feature/multi-day-shifts` (already created, with the spec committed).
- Before writing Next.js code, check `node_modules/next/dist/docs/` for anything touching server actions or client components (per `AGENTS.md`, this Next version differs from training data).
- Errors go through `ValidationError` / `ActionResult`, like the rest of `src/app/actions/schedule.ts`. Messages are plain sentences ending in a period.
- Exact copy: error `Pick at least one day.` (field `date`), button `Weekdays`, duration line `8h shift` for one day and `8h shift × 5 days` for several (built from `fmtDuration`), toasts `Shift added` (one day), `5 shifts added` (several), `Shift updated` (edit, unchanged).
- Unit tests: `npx vitest run <file>`. E2E: `npx playwright test tests/e2e/caretakers.spec.ts` (starts its own dev server on port 3100).

## Review Focus

1. **Someone used to the old sheet taps the day they want.** The opened day is already ticked, so tapping a different day adds it, and tapping the opened day unticks it. Pinned in Task 2: the "Juju's House" e2e unticks Monday, ticks Wed and Thu, and checks Monday stays empty.
2. **Save without touching the days.** The opened day (or the gap's day for "Fill") is ticked, so exactly one shift is added. Pinned in Task 2: the "planning a week" e2e checks Monday is ticked, then saves, and the Fill step checks the gap's day is ticked.
3. **"Weekdays" in a week with a day off.** The day off is left unticked. Pinned in Task 2's new e2e.
4. **The same date sent twice, or one bad date among several.** Each day gets one shift. A bad date or bad times mean nothing is saved. Pinned in Task 1's unit tests.
5. **"+ Someone new" with several days ticked.** The person is added once and gets every day's shift. Pinned in Task 2: the Juju e2e checks Wed and Thu, and that there's one `Sitter Ana` hours chip.

---

### Task 1: Server: `addShifts`, and new shifts accept several dates

**Files:**
- Modify: `src/lib/schedule/repo.ts` (add `addShifts`; `addShift` delegates to it)
- Modify: `src/app/actions/schedule.ts` (`saveShiftAction`)
- Test: `tests/unit/schedule-repo.test.ts`

**Interfaces:**
- Produces: `addShifts(db: DB, dates: string[], shift: Omit<ShiftInput, 'date'>): Promise<number[]>` in `@/lib/schedule/repo`. It returns one new id per distinct date.
- Produces: `saveShiftAction(form: FormData)`. Without `id`, it adds one shift per value of the repeated `date` field. With `id`, it updates that shift using the single `date`, as now. The other fields are unchanged: `personId` or `newName`, `start`, `end`.

- [ ] **Step 1: Write the failing repo tests.** Add `addShifts` to the import in `tests/unit/schedule-repo.test.ts`, and add these to `describe('shifts', …)`:

```ts
test('the same shift is added once on every day picked', async () => {
  const { db, lauren } = await setup();
  const ids = await addShifts(db, ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-25'], { personId: lauren, start: '08:00', end: '16:00' });
  expect(ids).toHaveLength(3);
  const week = plain(await getWeek(db, THIS_WEEK));
  expect(week.slice(0, 3)).toEqual([['Lauren 08:00-16:00'], ['Lauren 08:00-16:00'], ['Lauren 08:00-16:00']]);
  expect(week[3]).toEqual([]);
});

test('no days, a bad day or bad times add nothing', async () => {
  const { db, lauren } = await setup();
  const shift = { personId: lauren, start: '08:00', end: '16:00' };
  await expect(addShifts(db, [], shift)).rejects.toMatchObject({ name: 'ValidationError', field: 'date', message: 'Pick at least one day.' });
  await expect(addShifts(db, ['2026-11-23', 'not-a-date'], shift)).rejects.toMatchObject({ name: 'ValidationError', field: 'date' });
  await expect(addShifts(db, ['2026-11-23', '2026-11-24'], { ...shift, end: '07:00' })).rejects.toMatchObject({ field: 'end' });
  expect(plain(await getWeek(db, THIS_WEEK)).flat()).toEqual([]);
});
```

- [ ] **Step 2: Run them to see them fail.**
Run: `npx vitest run tests/unit/schedule-repo.test.ts`
Expected: FAIL. `addShifts` is not exported.

- [ ] **Step 3: Implement `addShifts` in `src/lib/schedule/repo.ts`.** Remove duplicate dates. If there are none left, throw `ValidationError('Pick at least one day.', 'date')`. Run the existing `check()` on every `{ date, ...shift }` before inserting anything. Then do one multi-row `insert … returning({ id })`, so it's all or nothing even outside a transaction. Rewrite `addShift(db, input)` as `(await addShifts(db, [input.date], input))[0]`, keeping its signature.

- [ ] **Step 4: Update `saveShiftAction` in `src/app/actions/schedule.ts`.** Build `shift = { personId, start, end }` once. With `id`, call `updateShift(tx, id, { ...shift, date: text(form, 'date') })`. Without one, call `addShifts(tx, form.getAll('date').map(String), shift)`. Fix the imports (`addShift` is no longer used here). The `+ Someone new` person is still created once, inside the same transaction.

- [ ] **Step 5: Run the full unit suite and the type check.**
Run: `npx vitest run && npx tsc --noEmit`
Expected: everything passes. That includes the existing `addShift` / `copyWeek` / `copyDay` tests and the `saveShiftAction` role check in `tests/unit/action-roles.test.ts` (it still sends a single `date`). tsc prints nothing.

- [ ] **Step 6: Commit.**
```bash
git add src/lib/schedule/repo.ts src/app/actions/schedule.ts tests/unit/schedule-repo.test.ts
git commit -m "feat: add the same shift on several days in one save"
```

### Task 2: The shift sheet picks several days

**Files:**
- Modify: `src/components/caretakers/ShiftSheet.tsx`
- Test: `tests/e2e/caretakers.spec.ts` (update three existing tests, add one)

**Interfaces:**
- Consumes: `saveShiftAction(form)` with repeated `date` when adding (Task 1). `DayData.weekend` and `DayData.dayOff` from `./types`.
- Produces: no new exports. `ShiftSheet`'s props and `ShiftDraft` are unchanged.

- [ ] **Step 1: Update the existing e2e tests for the pre-ticked day.** In `tests/e2e/caretakers.spec.ts`:
  - **"planning a week":** replace `await sheet.locator('.opt span', { hasText: /^Mon / }).click();` with `await expect(sheet.getByRole('checkbox', { name: /^Mon / })).toBeChecked();`. After the Fill click, add `await expect(page.getByRole('dialog').getByRole('checkbox', { name: /^Mon / })).toBeChecked();`.
  - **"Juju's House":** replace the single Wed click with clicks on the `.opt span`s for `/^Mon /` (unticks it), `/^Wed /` and `/^Thu /`. After saving, assert `dayRow(page, 'Thu')` contains `Sitter Ana`, `dayRow(page, 'Mon')` does not, and `page.locator('.hour-chip', { hasText: 'Sitter Ana' })` has count 1.
  - **"copying one day":** replace the Mon click with the same `toBeChecked()` assertion used in "planning a week".

- [ ] **Step 2: Write the new e2e test** at the end of the file (week 5 weeks out, because earlier tests fill weeks +1, +3 and +4):

```ts
test('adding one shift on several days at once', async ({ page }) => {
  await signIn(page);
  await page.goto('/calendar/caretakers');
  for (let i = 0; i < 5; i++) await goNextWeek(page);
  await expect(page.getByText('Nothing planned yet')).toBeVisible();

  // Unticking every day is refused
  await page.getByRole('button', { name: 'Or add one shift' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByText('Dad', { exact: true }).click();
  await sheet.locator('.opt span', { hasText: /^Mon / }).click();
  await sheet.getByRole('button', { name: 'Save shift' }).click();
  await expect(sheet.getByText('Pick at least one day.')).toBeVisible();

  // Weekdays ticks Monday to Friday
  await sheet.getByRole('button', { name: 'Weekdays' }).click();
  for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) await expect(sheet.getByRole('checkbox', { name: new RegExp(`^${d} `) })).toBeChecked();
  await expect(sheet.getByRole('checkbox', { name: /^Sat / })).not.toBeChecked();
  await sheet.getByLabel('Starts').fill('08:00');
  await sheet.getByLabel('Ends').fill('16:00');
  await expect(sheet.getByText('8h shift × 5 days')).toBeVisible();
  await sheet.getByRole('button', { name: 'Save shift' }).click();
  await expect(page.getByText('5 shifts added')).toBeVisible();
  for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) await expect(dayRow(page, d)).toContainText('8:00 am – 4:00 pm');
  await expect(dayRow(page, 'Sat')).not.toContainText('Dad');

  // Editing stays one day
  await dayRow(page, 'Tue').locator('button.shift').click();
  await expect(page.getByRole('dialog').getByRole('radio', { name: /^Tue / })).toBeChecked();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Weekdays' })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  // Weekdays leaves out a day off
  await page.getByRole('button', { name: /^Day options for Thu/ }).click();
  await page.getByRole('dialog').getByLabel('Mark as a day off').fill('Thanksgiving');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Add shift' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Weekdays' }).click();
  await expect(page.getByRole('dialog').getByRole('checkbox', { name: /^Thu / })).not.toBeChecked();
  await expect(page.getByRole('dialog').getByRole('checkbox', { name: /^Wed / })).toBeChecked();
});
```

- [ ] **Step 3: Run the caretakers e2e file to see it fail.**
Run: `npx playwright test tests/e2e/caretakers.spec.ts`
Expected: FAIL. No checkbox named `Mon …` exists yet (the days are radios), and there's no `Weekdays` button.

- [ ] **Step 4: Change `ShiftSheet` in `src/components/caretakers/ShiftSheet.tsx`.**
  - State `picked: Set<string>`, starting as `new Set([draft.date])`. Count `n = editing ? 1 : picked.size`.
  - "Which day?": when editing, keep the radios exactly as they are. When adding, each `.opt` holds a `type="checkbox"` with `name="date"`, `checked={picked.has(d.date)}`, and an `onChange` that toggles it. The label text stays `{d.dow} {d.dayNum}`, so the accessible name starts with the weekday.
  - When adding, also render a `type="button"` labelled `Weekdays` with class `food-chip` in that fieldset. It sets `picked` to the dates of `days` where `!d.weekend && !d.dayOff`.
  - `submit`: after the existing "who" check, if adding with `picked.size === 0`, call `setError({ message: 'Pick at least one day.', field: 'date' })` and stop. On success, toast `Shift updated` when editing, `Shift added` when `n === 1`, and `` `${n} shifts added` `` otherwise.
  - Duration line: when valid, `` `${fmtDuration(…)} shift` `` plus `` ` × ${n} days` `` when `n > 1`.

- [ ] **Step 5: Run the caretakers e2e file, lint, type check and unit suite.**
Run: `npx playwright test tests/e2e/caretakers.spec.ts && npx eslint src tests && npx tsc --noEmit && npx vitest run`
Expected: all six caretakers tests pass, lint and tsc are clean, and the unit tests pass.

- [ ] **Step 6: Commit.**
```bash
git add src/components/caretakers/ShiftSheet.tsx tests/e2e/caretakers.spec.ts
git commit -m "feat: pick several days when adding a shift"
```
