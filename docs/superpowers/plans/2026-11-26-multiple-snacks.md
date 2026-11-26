# Log Several Snacks a Day Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ezra's day holds any number of snacks, each with its own food, amount and time, the same way naps already work.

**Architecture:** Snacks move out of the once-a-day `log_slots` table into their own `snacks` table, and a migration carries existing snacks over. `getDayLog` returns them as a sorted list, and `saveSnack`/`deleteSnack` handle them by id. On Today, the Snack tile shows the latest snack and a count. Tapping it opens a `SnackSheet` list, built like `NapSheet`, and the food and amount fields are shared with the once-a-day meal sheet.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, Drizzle ORM over Postgres/PGlite, drizzle-kit, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-26-multiple-snacks-design.md`

## Global Constraints

- Work in `C:\Users\asabb\Projects\baby_org` on branch `feature/multiple-snacks`. The branch already exists and the spec is committed on it.
- Before writing Next.js code, check `node_modules/next/dist/docs/` for anything touching server actions or client components (per `AGENTS.md`).
- Run vitest from an **upper-case** `C:` path (`cd 'C:/Users/asabb/Projects/baby_org'` in Bash). If every file fails with "reading 'config'", the drive letter is lower-case. That isn't a code bug.
- Follow the nap code (`saveNap`, `NapSheet`, `NapTile`, `drizzle/0002_multiple_naps.sql`) wherever this plan doesn't say otherwise.
- Exact copy: list title `Snacks`, list subtitle `1 snack` / `N snacks`, list label `Snacks today`, button `Add another snack`, back link `‹ All snacks`, form titles `Snack` (first) / `Another snack` / `Edit snack`, toasts `Snack saved. Everyone can see it now.` and `Snack removed`, food error `Write what he ate, like "banana and yogurt".` (field `food`), time label `What time?`.
- Defaults for a new snack: time `15:00`, amount `Most`.
- Breakfast, lunch and dinner stay once a day. Don't change naps or notes.

## Review Focus

1. **Snacks saved before this ships.** Each one shows up in the new list exactly once, and none are left behind in `log_slots`. Pinned in Task 1 by the migration test.
2. **Two snacks at the same time.** For example, both left at the 3:00 pm default. Both are kept and listed in the order they were saved. Pinned in Task 1 by the "several snacks" unit test.
3. **A page left open across the deploy still sends `slot=snack` to the once-a-day save.** The save is rejected rather than written somewhere nothing reads. Pinned in Task 1 by the "snacks are no longer a single slot" unit test.
4. **Editing one snack.** Only that snack changes, and it shows the editor's name. Pinned in Task 1 by the edit unit test.
5. **Removing the last snack.** The tile goes back to "Add Snack" and the logged count drops. Pinned in Task 2 by the e2e.

---

### Task 1: Snacks as their own list, on the server

The UI files (`tiles.ts`, `TodayTiles.tsx`, `page.tsx`) will fail `tsc` at the end of this task, because `snack` is no longer a slot. Task 2 fixes them. This task is checked with vitest only.

**Files:**
- Modify: `src/db/schema.ts` (add `snacks` after `naps`)
- Create: `drizzle/0005_multiple_snacks.sql` and `drizzle/meta/0005_snapshot.json` (generated, then the SQL is hand-extended), plus the `drizzle/meta/_journal.json` update
- Modify: `src/lib/log-types.ts`, `src/lib/log.ts`, `src/app/actions/log.ts`
- Modify: `docs/superpowers/specs/2026-11-25-ezra-caretaker-app-design.md` §7.4 (data model)
- Test: `tests/unit/log.test.ts`, `tests/unit/migrations.test.ts`, `tests/unit/action-roles.test.ts`

**Interfaces:**
- Produces in `@/lib/log-types` (and re-exported by `@/lib/log`):
  - `SLOTS = ['wake', 'breakfast', 'lunch', 'dinner']`
  - `MEAL_SLOTS = ['breakfast', 'lunch', 'dinner']`
  - `type SnackEntry = { id: number; time: string; food: string; amount: string | null; byName: string }`
  - `DayLog` gains `snacks: SnackEntry[]`, sorted by time and then by id
- Produces in `@/lib/log`:
  - `saveSnack(db: DB, input: { id?: number; date: string; time: string; food?: string; amount?: string }, userId: number, today: string): Promise<void>`
  - `deleteSnack(db: DB, id: number): Promise<void>`
- Produces in `@/app/actions/log`:
  - `saveSnackAction(form: FormData): Promise<ActionResult>`, which reads the fields `id` (optional), `date`, `time`, `food` and `amount`
  - `deleteSnackAction(id: number): Promise<ActionResult>`
  - Both actions call `requireUser()`, so caretakers can use them.

- [ ] **Step 1: Write the failing unit tests** in `tests/unit/log.test.ts`. Import `saveSnack` and `deleteSnack`.
  - In "a saved breakfast…", replace `expect(day.slots.snack).toBeNull()` with `expect(day.slots.lunch).toBeNull(); expect(day.snacks).toEqual([]);`.
  - Next to "naps are no longer a single slot", add the same test for snacks:

```ts
test('snacks are no longer a single slot', async () => {
  const { db, mom } = await setup();
  // @ts-expect-error 'snack' is not a slot any more
  await expect(saveSlot(db, { date: TODAY, slot: 'snack', time: '15:00', food: 'Crackers' }, mom, TODAY)).rejects.toMatchObject({ name: 'ValidationError' });
});
```

  - Add `describe('snacks', …)`:

```ts
test('a day can have several snacks, sorted by time then save order, each showing who saved it', async () => {
  const { db, mom, selina } = await setup();
  await saveSnack(db, { date: TODAY, time: '15:00', food: 'Crackers', amount: 'Some' }, selina, TODAY);
  await saveSnack(db, { date: TODAY, time: '10:00', food: 'Apple slices', amount: 'All' }, mom, TODAY);
  await saveSnack(db, { date: TODAY, time: '15:00', food: '  Cheese ' }, mom, TODAY);
  const day = await getDayLog(db, TODAY);
  expect(day.snacks.map((s) => `${s.time} ${s.food} ${s.amount} ${s.byName}`)).toEqual([
    '10:00 Apple slices All Mom',
    '15:00 Crackers Some Selina',
    '15:00 Cheese null Mom',
  ]);
});

test('a snack needs what he ate, a known amount, a real time and a day that has happened', async () => {
  const { db, mom } = await setup();
  await expect(saveSnack(db, { date: TODAY, time: '15:00', food: ' ' }, mom, TODAY)).rejects.toMatchObject({
    field: 'food',
    message: 'Write what he ate, like "banana and yogurt".',
  });
  await expect(saveSnack(db, { date: TODAY, time: '15:00', food: 'Rice', amount: 'Lots' }, mom, TODAY)).rejects.toMatchObject({ name: 'ValidationError' });
  await expect(saveSnack(db, { date: TODAY, time: '3pm', food: 'Rice' }, mom, TODAY)).rejects.toMatchObject({ field: 'time' });
  await expect(saveSnack(db, { date: '2026-11-26', time: '15:00', food: 'Rice' }, mom, TODAY)).rejects.toMatchObject({
    message: "You can't log a day that hasn't happened yet.",
  });
  expect((await getDayLog(db, TODAY)).snacks).toEqual([]);
});

test('editing one snack changes only that one; a snack can be deleted', async () => {
  const { db, mom, selina } = await setup();
  await saveSnack(db, { date: TODAY, time: '10:00', food: 'Apple slices', amount: 'All' }, mom, TODAY);
  await saveSnack(db, { date: TODAY, time: '15:00', food: 'Crackers', amount: 'Some' }, mom, TODAY);
  const [morning, afternoon] = (await getDayLog(db, TODAY)).snacks;
  await saveSnack(db, { id: morning.id, date: TODAY, time: '10:30', food: 'Pear slices', amount: 'Most' }, selina, TODAY);
  expect((await getDayLog(db, TODAY)).snacks).toEqual([
    { id: morning.id, time: '10:30', food: 'Pear slices', amount: 'Most', byName: 'Selina' },
    afternoon,
  ]);
  await deleteSnack(db, morning.id);
  expect((await getDayLog(db, TODAY)).snacks).toEqual([afternoon]);
});
```

  - Replace the first `recentFoods` test so it covers snacks, mixed by date with meals:

```ts
test('splits recent meals and snacks into foods, newest first, padded with defaults', async () => {
  const { db, mom } = await setup();
  await saveSnack(db, { date: '2026-11-23', time: '15:00', food: 'Apple slices', amount: 'All' }, mom, TODAY);
  await saveSlot(db, { date: '2026-11-24', slot: 'lunch', time: '12:00', food: 'Pasta with peas and cheese', amount: 'All' }, mom, TODAY);
  await saveSnack(db, { date: TODAY, time: '15:00', food: 'Yogurt and banana', amount: 'All' }, mom, TODAY);

  const foods = await recentFoods(db);
  expect(foods).toHaveLength(10);
  expect(foods.slice(0, 6)).toEqual(['Yogurt', 'Banana', 'Pasta', 'Peas', 'Cheese', 'Apple slices']);
  expect(new Set(foods.map((f) => f.toLowerCase())).size).toBe(10);
});
```

- [ ] **Step 2: Write the failing migration test** in `tests/unit/migrations.test.ts`, modeled on the nap one. Find the file containing `multiple_snacks`, apply every migration before it, insert a user and two `log_slots` rows: `('2026-11-24', 'snack', '15:10', 'Yogurt and banana', 'All', 1)` and `('2026-11-24', 'lunch', '11:50', 'Pasta', 'Most', 1)` (columns `date, slot, time, food, amount, updated_by`). Then apply the snack migration and assert:

```ts
expect(snacks.rows).toEqual([{ date: '2026-11-24', time: '15:10', food: 'Yogurt and banana', amount: 'All', created_by: 1 }]);
expect(slots.rows.map((r) => r.slot)).toEqual(['lunch']);
```

  Here `snacks` is `SELECT to_char(date, 'YYYY-MM-DD') AS date, time, food, amount, created_by FROM snacks`, and `slots` is `SELECT slot FROM log_slots`.

- [ ] **Step 3: Add the caretaker check** to the "logging works" test in `tests/unit/action-roles.test.ts`. Import `saveSnackAction`, then add:

```ts
expect(await saveSnackAction(form({ date: '2026-11-25', time: '15:00', food: 'Crackers', amount: 'Some' }))).toEqual({ ok: true });
```

- [ ] **Step 4: Run the tests and confirm they fail.**
  Run: `cd 'C:/Users/asabb/Projects/baby_org' && npx vitest run tests/unit/log.test.ts tests/unit/migrations.test.ts tests/unit/action-roles.test.ts`
  Expected: FAIL. `saveSnack` and `saveSnackAction` are not exported, and the migration test finds no `multiple_snacks` file.

- [ ] **Step 5: Add the `snacks` table** to `src/db/schema.ts`. It has the same shape as `logNotes`: `id` serial PK, `date` (date, string mode), `time` text not null, `food` text not null, `amount` text (nullable), `createdBy`/`updatedBy` integer not null referencing `users.id`, and `createdAt`/`updatedAt` `ts(...)` not null, defaulting to now.

- [ ] **Step 6: Generate the migration.**
  Run: `npx drizzle-kit generate --name multiple_snacks`
  Expected: it creates `drizzle/0005_multiple_snacks.sql` (the `CREATE TABLE "snacks"` statement and two foreign keys), `drizzle/meta/0005_snapshot.json`, and a new `_journal.json` entry. Then append the carry-over to the end of the SQL file, exactly:

```sql
--> statement-breakpoint
-- Carry over snacks saved in the old once-a-day format.
INSERT INTO "snacks" ("date", "time", "food", "amount", "created_by", "updated_by", "created_at", "updated_at") SELECT "date", "time", COALESCE("food", ''), "amount", "updated_by", "updated_by", "updated_at", "updated_at" FROM "log_slots" WHERE "slot" = 'snack';--> statement-breakpoint
DELETE FROM "log_slots" WHERE "slot" = 'snack';
```

- [ ] **Step 7: Implement the library and actions.**
  - `log-types.ts`: apply the Interfaces changes above.
  - `log.ts`: move the meal checks out of `saveSlot` into `checkMeal(food: string | undefined, amount: string | undefined): { food: string; amount: string | null }`, so that `saveSlot` and `saveSnack` share the same rules and messages. `saveSnack` updates by `id` when given and inserts otherwise, like `saveNap`. `getDayLog` also selects the day's snacks, joined to `users` on `updatedBy`, ordered by `asc(snacks.time), asc(snacks.id)`. `recentFoods` reads up to 30 recent rows from both meals and `snacks`, merges them newest first by `(date desc, updatedAt desc)`, keeps 30, then splits them as it does today.
  - `actions/log.ts`: add `saveSnackAction` and `deleteSnackAction`, built like the nap actions. `food` and `amount` are read with the existing `optional(...)` helper.

- [ ] **Step 8: Update the data model** in the main design doc, §7.4. Remove `snack` from the `log_slots` slot list, and add `snacks: id, date, time, food, amount, created_by, updated_by, timestamps. Several per day.` after `naps`.

- [ ] **Step 9: Run the tests and confirm they pass.**
  Run: `cd 'C:/Users/asabb/Projects/baby_org' && npx vitest run`
  Expected: all pass, including the three files above.

- [ ] **Step 10: Commit.**

```bash
git add src/db/schema.ts drizzle src/lib/log-types.ts src/lib/log.ts src/app/actions/log.ts tests/unit docs/superpowers/specs/2026-11-25-ezra-caretaker-app-design.md
git commit -m "feat: store as many snacks a day as Ezra eats"
```

---

### Task 2: Snack tile and Snacks sheet on Today

**Files:**
- Create: `src/components/today/MealFields.tsx`, holding the food box with recent-food chips and the "How much did he eat?" radios, moved out of `TileSheet` unchanged
- Create: `src/components/today/SnackSheet.tsx`
- Modify: `src/components/today/TileSheet.tsx`, `src/components/today/tiles.ts`, `src/components/today/TodayTiles.tsx`, `src/app/(app)/page.tsx`
- Modify: `docs/superpowers/specs/2026-11-25-ezra-caretaker-app-design.md` §6.1
- Test: `tests/e2e/today.spec.ts`

**Interfaces:**
- Consumes: `SnackEntry`, `DayLog.snacks`, `saveSnackAction` and `deleteSnackAction` from Task 1.
- Produces:
  - `MealFields({ foods, entry, error }: { foods: string[]; entry: { food: string | null; amount: string | null } | null; error: FormError })`. It renders the food textarea (`name="food"`, label `What did he eat?`) with chips, and the amount radios (`name="amount"`), with `Most` picked when `entry` is null.
  - `SnackSheet({ date, snacks, foods, onClose }: { date: string; snacks: SnackEntry[]; foods: string[]; onClose: () => void })`
  - In `tiles.ts`: `TileKey = SlotKey | 'nap' | 'snack'`, a `kind` of `'snack'` for the Snack tile (same label, color and icon as now), `DEFAULT_TIME` without `snack`, and `DEFAULT_SNACK_TIME = '15:00'`.
  - `TodayTiles` props gain `snacks: SnackEntry[]`.

- [ ] **Step 1: Write the failing e2e.** In `tests/e2e/today.spec.ts`, insert this between "A second nap the same day" and "Something else":

```ts
// Two snacks the same day
await page.getByRole('button', { name: 'Add Snack' }).click();
await page.getByRole('dialog').getByLabel('What did he eat?').fill('Apple slices');
await page.getByRole('dialog').getByLabel('What time?').fill('10:00');
await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
await expect(page.getByText('Snack saved. Everyone can see it now.')).toBeVisible();
const snackTile = page.getByRole('button', { name: /^Snack/ });
await expect(snackTile).toContainText('Apple slices');
await expect(snackTile).toContainText('10:00 am · ate most');
await expect(page.getByText('2 of 6 logged')).toBeVisible();

await snackTile.click();
await page.getByRole('dialog').getByRole('button', { name: 'Add another snack' }).click();
await page.getByRole('dialog').getByLabel('What did he eat?').fill('Crackers');
await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
await expect(snackTile).toContainText('Crackers');
await expect(snackTile).toContainText('3:00 pm · 2 snacks');

// Remove them one at a time
await snackTile.click();
await expect(page.getByRole('dialog')).toContainText('2 snacks');
await page.getByRole('dialog').getByRole('button', { name: /Apple slices/ }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
await expect(page.getByText('Snack removed')).toBeVisible();
await expect(snackTile).toContainText('3:00 pm · ate most');
await snackTile.click();
await page.getByRole('dialog').getByRole('button', { name: /Crackers/ }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
await expect(page.getByRole('button', { name: 'Add Snack' })).toBeVisible();
await expect(page.getByText('1 of 6 logged')).toBeVisible();
```

- [ ] **Step 2: Run it and confirm it fails.**
  Run: `npx playwright test tests/e2e/today.spec.ts`
  Expected: FAIL. The build doesn't compile yet, or "Add another snack" isn't found.

- [ ] **Step 3: Extract `MealFields`** from `TileSheet`, and have `TileSheet` render it for `kind === 'meal'`. Breakfast, lunch and dinner must look and behave exactly as before.

- [ ] **Step 4: Build `SnackSheet`,** mirroring `NapSheet`, including the list-or-form start, the `key` per entry, and the back link.
  - **List view:** each row shows `fmtTime(time)`, the food, and then the amount text (`AMOUNT_TEXT`, when set) and who saved it.
  - **Form:** hidden `date` (plus hidden `id` when editing), then `MealFields`, then the `What time?` field (`id="f-time"`, `name="time"`, default `DEFAULT_SNACK_TIME`).
  - Use the copy from Global Constraints. Error fields for `FormMessage` are `['time', 'food']`.

- [ ] **Step 5: Wire up the tile and the page.**
  - **`TodayTiles`:** add a `SnackTile`. With no snacks it renders `EmptyTile`. Otherwise it uses `latest = snacks[snacks.length - 1]` and shows `t-food` with `latest.food` and `t-meta` with:
    - one snack: `fmtTime(time)` plus ` · {AMOUNT_TEXT}` when an amount is set
    - several: `{fmtTime(latest.time)} · {n} snacks`

    `Who` is `latest.byName`. Opening `'snack'` renders `<SnackSheet key={`${date}-snack`} …>`.
  - **`page.tsx`:** the Snack tile counts as filled when `day.snacks.length > 0`. Pass `snacks={day.snacks}`.

- [ ] **Step 6: Update the main design doc, §6.1.** Take Snack out of the "Breakfast, Lunch, Snack, Dinner" bullet. Add a Snack bullet saying it holds as many snacks as he eats (changed by owner, 2026-11-26). Describe the tile (the latest snack's food, plus its amount when there's one snack or "N snacks" when there are more) and the list with "Add another snack", in the same style as the Nap bullet.

- [ ] **Step 7: Run every check and confirm it passes.**
  Run: `npx tsc --noEmit && npm run lint && npx playwright test tests/e2e/today.spec.ts`, then `cd 'C:/Users/asabb/Projects/baby_org' && npx vitest run`
  Expected: no type or lint errors, the today e2e passes, and all unit tests pass.

- [ ] **Step 8: Commit.**

```bash
git add src/components/today src/app/\(app\)/page.tsx tests/e2e/today.spec.ts docs/superpowers/specs/2026-11-25-ezra-caretaker-app-design.md
git commit -m "feat: list the day's snacks with 'Add another snack'"
```
