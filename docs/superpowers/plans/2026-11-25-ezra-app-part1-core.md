# Ezra's App, Part 1 (Core): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the installable family app with sign-in, roles, the Today log, the caretaker schedule, accounts and settings. Everything except classes and nearby ideas, which are Part 2.

**Architecture:** Next.js App Router on Vercel. Server components read through small domain modules in `src/lib/` that take a Drizzle `db` argument, and server actions call the same modules after a permission check. Production uses Neon Postgres over `pg`. Local dev and all tests use in-process PGlite, so nobody needs a database to develop or test. Pure logic (time, coverage, gaps) has no database dependency.

**Tech Stack:** Next.js (latest stable, 16.x expected) + React 19 + TypeScript, Drizzle ORM + drizzle-kit, `pg` (production), `@electric-sql/pglite` (dev/test), bcryptjs, zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-ezra-caretaker-app-design.md`. **Visual and copy source:** `docs/mockups/ezra-mockup.html`, Option A only. Its `viewToday`, `tile`, `nowCard`, `noteRow`, `caretakersView`, `dayRow`, `openTileSheet`, `openNoteSheet`, `openShiftSheet`, `openCopySheet`, `openAccount` and `viewSignin` functions plus the CSS before the `Option B` comment are the reference markup, class names and copy. Port them, don't redesign them.

## Global Constraints

- All dates and times are **America/New_York**, regardless of the server's or phone's zone. Dates are `YYYY-MM-DD` strings, times `HH:MM` 24h strings.
- Look = mockup Option A: warm cream tokens, sage/peach/sky/lav/butter (+soft/ink), Fredoka headings, Figtree body, body text ≥ 17px, light and dark via `prefers-color-scheme`, every form in a bottom sheet.
- No public sign-up. Accounts are created by family members. The first account comes from `OWNER_NAME` / `OWNER_EMAIL` / `OWNER_PASSWORD` env.
- Session cookie `ezra_session`: httpOnly, `Secure` in production, `SameSite=Lax`, 365 days, rolling.
- Sign-in lockout: 5 failures, then 15 minutes, per email (case-insensitive, trimmed).
- Roles: `family` can do everything. `caretaker` can view everything and add/edit/delete log entries, but **cannot** change shifts, days off, people or settings. The server enforces this, and the UI hides those controls.
- One nap per day. Six slots: `wake`, `breakfast`, `nap`, `lunch`, `snack`, `dinner`.
- Note kinds: `Note`, `Health`, `Medicine`, `Diaper`, `Milestone`. Meal amounts: `All`, `Most`, `Some`, `A little`, `None`.
- Coverage default: Mon–Fri, 08:00–18:30. Weeks run Monday to Sunday. The schedule can be navigated from last week to 8 weeks ahead.
- Clients refresh data on focus/visibility and every 60 s while visible.
- Free tiers only (Vercel Hobby + Neon). No other third-party accounts.
- Commit after each task on branch `feature/core-app` (create it from `main` before Task 1).

## Review Focus

1. **Late evening in New York, UTC server:** at 11:30 pm NY (already the next day in UTC), "today" must still be the NY date, and logging tonight's dinner must not be rejected as "future". Pinned in Task 1 (`todayNY`) and Task 5 (`saveSlot` with an injected `today`).
2. **Daylight-saving weeks:** `addDays` and `weekStartOf` across the Nov 1 2026 and Mar 14 2027 changes must not skip or repeat a day. Pinned in Task 1.
3. **Shifts that overlap or run outside the coverage window** (7:00–9:00, 8:00–16:00 and 15:00–20:00 on the same day) must produce no false gaps and no negative widths. Pinned in Task 7.
4. **Two people saving the same slot at once** (Mom and Selina both log lunch): the last save wins, it shows the last saver's name, and nothing errors. Pinned in Task 5.
5. **Email typed with capitals or spaces** (" Mom@Example.com "): sign-in, lockout and duplicate-account checks all treat it as the same email. Pinned in Tasks 3 and 10.

---

## File Structure

```
package.json, next.config.ts, tsconfig.json, drizzle.config.ts, vitest.config.ts, playwright.config.ts, .env.example
drizzle/                         generated SQL migrations (drizzle-kit generate)
scripts/migrate.ts               apply migrations + bootstrap (production build step)
src/db/schema.ts                 all Part 1 tables
src/db/client.ts                 getDb(): pg Pool if DATABASE_URL, else PGlite (+auto-migrate, bootstrap)
src/db/migrate.ts                runMigrations(db) shared by client, script and tests
tests/helpers/test-db.ts         createTestDb(): fresh in-memory PGlite with migrations
src/lib/time.ts                  NY clock + date math + display formatting
src/lib/errors.ts                ValidationError, ForbiddenError, ActionResult
src/lib/bootstrap.ts             ensureSettings, ensureOwner
src/lib/auth/password.ts         hash/verify
src/lib/auth/session.ts          create/validate/delete sessions
src/lib/auth/rate-limit.ts       lockout bookkeeping
src/lib/auth/sign-in.ts          signIn() orchestration
src/lib/auth/permissions.ts      isFamily, assertFamily
src/lib/auth/current-user.ts     cookie → user (server only), requireUser, requireFamily
src/lib/people.ts                accounts + schedule people
src/lib/settings.ts              settings read/update
src/lib/log.ts                   day log read/write + recent foods
src/lib/schedule/coverage.ts     pure: needsCoverage, gapsFor, nowWithEzra, weeklyHours
src/lib/schedule/repo.ts         shifts, days off, copy week, week view
src/proxy.ts                     route guard (named middleware.ts on Next 15)
src/app/layout.tsx, globals.css, manifest.ts, icons/[size]/route.tsx, apple-icon.tsx
src/app/signin/page.tsx          sign-in screen
src/app/(app)/layout.tsx         tab bar, AutoRefresh, toast host
src/app/(app)/page.tsx           Today
src/app/(app)/calendar/page.tsx  redirect → /calendar/caretakers (Part 2 changes to classes)
src/app/(app)/calendar/classes/page.tsx      placeholder until Part 2
src/app/(app)/calendar/caretakers/page.tsx   schedule
src/app/actions/{auth,log,schedule,people}.ts server actions
src/components/{Sheet,Toast,TabBar,AutoRefresh,AvatarButton}.tsx
src/components/today/*.tsx       Tiles, NowCard, Notes, TileSheet, NoteSheet
src/components/caretakers/*.tsx  WeekNav, DayRow, ShiftSheet, CopyWeekSheet, DayOffSheet, Hours
src/components/account/*.tsx     AccountSheet, PeopleSection, SettingsSection, PasswordSection
tests/unit/*.test.ts             Vitest (PGlite-backed where a db is needed)
tests/e2e/*.spec.ts              Playwright against `next dev` on in-memory PGlite
```

---

### Task 1: Scaffold the app and the time helpers

**Files:**
- Create: the Next.js project at the repo root (`npx create-next-app@latest . --ts --eslint --app --src-dir --no-tailwind --import-alias "@/*"`, keeping `README.md` and `docs/`), `vitest.config.ts`, `playwright.config.ts`, `src/lib/time.ts`, `src/app/globals.css`, `src/app/layout.tsx`
- Test: `tests/unit/time.test.ts`

**Interfaces:**
- Produces (`src/lib/time.ts`): `TZ = 'America/New_York'`; `todayNY(now?: Date): string`; `minutesNowNY(now?: Date): number`; `addDays(date: string, n: number): string`; `dayOfWeek(date: string): number` (0 = Sun); `weekStartOf(date: string): string` (Monday); `toMin(t: string): number`; `fromMin(m: number): string`; `fmtTime(t: string | number): string`; `fmtRange(a: string | number, b: string | number): string`; `fmtDuration(min: number): string`; `fmtHours(min: number): string`; `fmtWeekRange(weekStart: string): string`; `fmtDayLong(date: string): string`; `fmtDayShort(date: string): string`

- [ ] **Step 1: Scaffold.** Run create-next-app as above. Add dev deps `vitest @playwright/test`, scripts `"test": "vitest run"` and `"e2e": "playwright test"`. Vitest config: `environment: 'node'`, include `tests/unit/**/*.test.ts`, alias `@` → `src`. Playwright config: `testDir: tests/e2e`, one project (`Pixel 7` device), `webServer` running `npm run dev:e2e` on port 3100 (script added in Task 4).
- [ ] **Step 2: Port the look.** Copy the mockup's Option A CSS (the `<style>` block up to the `Option B` comment, minus `.mock-bar`/`.opt-switch` rules) into `src/app/globals.css`. In `layout.tsx` load Fredoka (500, 600) and Figtree (400–700) with `next/font/google`, expose them as `--font-display` / `--font-body` on `<html>`, set `<html lang="en">`, and add viewport `viewport-fit=cover` plus `themeColor` `#FBF6EE` (light) / `#1C1916` (dark).
- [ ] **Step 3: Write the failing tests.**

```ts
import { todayNY, minutesNowNY, addDays, weekStartOf, fmtTime, fmtRange, fmtDuration, fmtHours, fmtWeekRange, fmtDayLong, fmtDayShort } from '@/lib/time';
test('NY date late evening while UTC is already tomorrow', () => {
  expect(todayNY(new Date('2026-11-26T04:30:00Z'))).toBe('2026-11-25'); // 11:30 pm EST
  expect(minutesNowNY(new Date('2026-11-26T04:30:00Z'))).toBe(23 * 60 + 30);
});
test('date math across DST changes', () => {
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  expect(addDays('2027-03-14', -1)).toBe('2027-03-13');
  expect(weekStartOf('2026-11-01')).toBe('2026-10-26'); // Sunday → previous Monday
  expect(weekStartOf('2027-03-14')).toBe('2027-03-08');
  expect(weekStartOf('2026-11-25')).toBe('2026-11-23');
});
test('display formats match the mockup', () => {
  expect(fmtTime('06:45')).toBe('6:45 am');
  expect(fmtTime(12 * 60)).toBe('12:00 pm');
  expect(fmtRange('09:50', '11:10')).toBe('9:50 – 11:10 am');
  expect(fmtRange('08:00', '16:00')).toBe('8:00 am – 4:00 pm');
  expect(fmtDuration(80)).toBe('1h 20m');
  expect(fmtDuration(45)).toBe('45m');
  expect(fmtDuration(120)).toBe('2h');
  expect(fmtHours(150)).toBe('2.5h');
  expect(fmtHours(480)).toBe('8h');
  expect(fmtWeekRange('2026-11-23')).toBe('Nov 23 – 29');
  expect(fmtWeekRange('2026-11-30')).toBe('Nov 30 – Dec 6');
  expect(fmtDayLong('2026-11-25')).toBe('Wednesday, November 25');
  expect(fmtDayShort('2026-11-25')).toBe('Wed, Nov 25');
});
```

- [ ] **Step 4: Run** `npm test -- time` and check it fails (module not found).
- [ ] **Step 5: Implement `src/lib/time.ts`.** `todayNY`/`minutesNowNY` use `Intl.DateTimeFormat('en-US', { timeZone: TZ, ... }).formatToParts`. All date math works on `Date.UTC(y, m - 1, d)` and never on local time. Port the formatters from the mockup's `fmtT`, `fmtRange`, `durTxt`, `hrsTxt` and `rangeTxt`.
- [ ] **Step 6: Run** `npm test` and `npm run build`. Expected: tests PASS, build succeeds.
- [ ] **Step 7: Commit** `feat: scaffold Next.js app with mockup styles and NY time helpers`.

---

### Task 2: Database schema, client and bootstrap

**Files:**
- Create: `src/db/schema.ts`, `src/db/migrate.ts`, `src/db/client.ts`, `drizzle.config.ts`, `drizzle/*` (generated), `tests/helpers/test-db.ts`, `src/lib/errors.ts`, `src/lib/bootstrap.ts`, `src/lib/auth/password.ts`, `.env.example`
- Modify: `next.config.ts` (`serverExternalPackages: ['@electric-sql/pglite']`)
- Test: `tests/unit/bootstrap.test.ts`

**Interfaces:**
- Produces: `type DB` (a Drizzle `PgDatabase` typed with `schema`, satisfied by both the node-postgres and PGlite drivers); `getDb(): Promise<DB>`; `runMigrations(db: DB): Promise<void>`; `createTestDb(): Promise<DB>`; tables `users, sessions, loginAttempts, schedulePeople, logSlots, logNotes, shifts, daysOff, settings`; `class ValidationError extends Error { field?: string }`; `class ForbiddenError extends Error`; `type ActionResult = { ok: true } | { ok: false; message: string; field?: string }`; `hashPassword(p: string): Promise<string>`; `verifyPassword(p: string, hash: string): Promise<boolean>`; `ensureSettings(db: DB): Promise<void>`; `ensureOwner(db: DB, env: { OWNER_NAME?: string; OWNER_EMAIL?: string; OWNER_PASSWORD?: string }): Promise<'created' | 'exists' | 'skipped'>`; `PERSON_COLORS = ['butter','peach','lav','sky','sage'] as const`

Schema (spec §7.4, Part 1 subset). `date` columns use `mode: 'string'`. Times are `text` `HH:MM`.
- `users`: `id` serial pk, `name`, `email` (unique, stored lowercased+trimmed), `passwordHash`, `role` (`'family'|'caretaker'`), `createdAt`, `disabledAt` nullable
- `sessions`: `id`, `userId` → users, `tokenHash` unique, `createdAt`, `lastUsedAt`, `expiresAt`
- `loginAttempts`: `email` pk, `failures` int, `lockedUntil` nullable timestamptz
- `schedulePeople`: `id`, `name`, `color`, `userId` nullable unique → users
- `logSlots`: pk (`date`, `slot`), `time`, `endTime`, `food`, `amount`, `updatedBy` → users, `updatedAt`
- `logNotes`: `id`, `date`, `time`, `kind`, `text`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`
- `shifts`: `id`, `date`, `personId` → schedulePeople, `startTime`, `endTime`, timestamps; check `end_time > start_time`
- `daysOff`: `date` pk, `label`
- `settings`: `id` int pk (always 1), `ezraBirthdate` date nullable, `coverageDays` int[] default `{1,2,3,4,5}`, `coverageStart` default `'08:00'`, `coverageEnd` default `'18:30'`

- [ ] **Step 1: Write the failing tests** (`tests/unit/bootstrap.test.ts`, using `createTestDb()`):
  - `ensureSettings` twice leaves exactly one row, with `coverageDays` `[1,2,3,4,5]`, `'08:00'` and `'18:30'`.
  - `ensureOwner` with all three env values on an empty db returns `'created'`. The user has role `family`, email lowercased (`' Dad@Example.com '` → `'dad@example.com'`), a password that `verifyPassword` accepts, and a linked `schedulePeople` row with color `'butter'`.
  - `ensureOwner` again returns `'exists'`. With a missing env value on an empty db it returns `'skipped'`.
- [ ] **Step 2: Run** `npm test -- bootstrap`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Write the schema, then `npx drizzle-kit generate` into `drizzle/`.
  - `runMigrations` uses Drizzle's `migrate()` for the matching driver.
  - `getDb()`: if `process.env.DATABASE_URL`, return node-postgres over a `pg` Pool, and don't migrate at runtime. Otherwise open PGlite at `process.env.PGLITE_DIR ?? './.data/pglite'` (`memory://` allowed), run `runMigrations`, `ensureSettings` and `ensureOwner(process.env)`. Cache it on `globalThis` so dev hot-reload reuses one instance.
  - `createTestDb()` is a fresh `new PGlite()` plus migrations.
  - Passwords use bcryptjs, cost 12.
  - `.env.example` lists `DATABASE_URL`, `OWNER_NAME`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `PGLITE_DIR`. Add `.data/` to `.gitignore`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: database schema, PGlite/Postgres client and owner bootstrap`.

---

### Task 3: Sessions, lockout and permissions

**Files:**
- Create: `src/lib/auth/session.ts`, `src/lib/auth/rate-limit.ts`, `src/lib/auth/sign-in.ts`, `src/lib/auth/permissions.ts`
- Test: `tests/unit/auth.test.ts`

**Interfaces:**
- Consumes: `DB`, tables, `hashPassword`/`verifyPassword`, `ForbiddenError`
- Produces: `type SessionUser = { id: number; name: string; email: string; role: 'family' | 'caretaker' }`; `SESSION_COOKIE = 'ezra_session'`; `SESSION_DAYS = 365`; `createSession(db, userId: number, now?: Date): Promise<string>` (raw token); `validateSession(db, token: string, now?: Date): Promise<SessionUser | null>`; `deleteSession(db, token: string): Promise<void>`; `deleteUserSessions(db, userId: number): Promise<void>`; `MAX_FAILURES = 5`; `LOCK_MINUTES = 15`; `signIn(db, email: string, password: string, now?: Date): Promise<{ ok: true; token: string } | { ok: false; message: string }>`; `isFamily(u: SessionUser): boolean`; `assertFamily(u: SessionUser): void` (throws `ForbiddenError('Only family members can change this.')`)

- [ ] **Step 1: Write the failing tests:**
  - A token from `createSession` validates to the user. The db stores only `sha256(token)` hex, never the token.
  - A session at `now + 366 days` with no use is `null`.
  - Rolling: validating at `now + 2 days` moves `expiresAt` to `that time + 365 days`. Validating again within the same day doesn't write.
  - A user with `disabledAt` set gets `null`.
  - `signIn(' DAD@example.com ', correct)` → `{ ok: true }`.
  - A wrong password → `{ ok: false, message: "That email and password don't match." }`.
  - After 5 wrong tries, a 6th try **with the correct password** at `now + 1 min` → `{ ok: false }` with a message starting `'Too many tries. Try again at '` and ending with the NY time 15 minutes after the 5th failure (e.g. `'3:45 pm.'`).
  - At `now + 16 min` the correct password works, and success clears the failures.
  - An unknown email gets the same "don't match" message, and failures still count for it.
  - `assertFamily({ role: 'caretaker', ... })` throws `ForbiddenError`.
- [ ] **Step 2: Run** `npm test -- auth`. Expected: FAIL.
- [ ] **Step 3: Implement.** Tokens are 32 bytes from `crypto.randomBytes`, base64url-encoded. Normalize emails with `email.trim().toLowerCase()` everywhere. `signIn` checks the lock first, then verifies (always running bcrypt, even for unknown emails, to keep timing flat), then records a failure or clears failures and creates the session.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: sessions, sign-in lockout and role checks`.

---

### Task 4: Sign-in screen, route guard and app shell

**Files:**
- Create: `src/lib/auth/current-user.ts`, `src/app/actions/auth.ts`, `src/app/signin/page.tsx`, `src/proxy.ts` (export `proxy`; on Next 15 use `src/middleware.ts` exporting `middleware`), `src/app/(app)/layout.tsx`, `src/components/{TabBar,Sheet,Toast,AutoRefresh,AvatarButton}.tsx`, `src/app/(app)/calendar/page.tsx`, `src/app/(app)/calendar/classes/page.tsx`
- Modify: `package.json` (`"dev:e2e": "PGLITE_DIR=memory:// OWNER_NAME=Dad OWNER_EMAIL=dad@test.local OWNER_PASSWORD=test-pass-123 next dev -p 3100"`, using `cross-env` for Windows)
- Test: `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `getDb`, `signIn`, `validateSession`, `deleteSession`, `SESSION_COOKIE`, `SESSION_DAYS`
- Produces: `getCurrentUser(): Promise<SessionUser | null>` (wrapped in React `cache`); `requireUser(): Promise<SessionUser>` (redirects to `/signin`); `requireFamily(): Promise<SessionUser>` (throws `ForbiddenError`); server actions `signInAction(prev: ActionResult | null, form: FormData): Promise<ActionResult>` (on success sets the cookie and redirects to `/`), `signOutAction(): Promise<void>`; components `<Sheet open onClose title icon? color?>` (scrim, grabber, Esc and scrim-tap to close, `role="dialog"`), `useToast(): (msg: string) => void` and `<ToastHost>`, `<AutoRefresh />` (`router.refresh()` on `visibilitychange`→visible, on `focus`, and every 60 000 ms while visible), `<TabBar />` (Today `/`, Calendar `/calendar`, `aria-current="page"`)

- [ ] **Step 1: Write the failing e2e test** (`tests/e2e/auth.spec.ts`):
  - Visiting `/` while signed out lands on `/signin`, showing the heading "Ezra" and the text "Forgot your password? Ask Dad, Mom or Lauren to reset it."
  - Signing in with the wrong password shows "That email and password don't match."
  - Signing in with `dad@test.local` / `test-pass-123` lands on `/` with the tab bar ("Today", "Calendar").
  - Reloading keeps you signed in.
  - The avatar → "Sign out" returns to `/signin` (the sign-out button can be a temporary bare button in the avatar sheet until Task 10).
  - The cookie `ezra_session` is `httpOnly` with `sameSite` `Lax`.
- [ ] **Step 2: Run** `npx playwright install chromium && npm run e2e -- auth`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Sign-in page: the mockup's `viewSignin` layout with fields email and password (`autocomplete="username"` / `"current-password"`), a "Sign in" button, and the forgot-password line from the spec. There's no "skip" link and no code screen.
  - Proxy/middleware: if there's no `ezra_session` cookie and the path isn't `/signin`, `/manifest.webmanifest`, `/icons/*`, `/apple-icon*` or Next internals, redirect to `/signin`. Full validation happens in `requireUser`.
  - `(app)/layout.tsx` calls `requireUser()` and renders the screen, `<TabBar>`, `<AutoRefresh>`, `<ToastHost>` and a sheet host.
  - `/calendar` redirects to `/calendar/caretakers`.
  - The classes page shows an empty state: "Classes are coming next." with the line "Your places' schedules will show up here."
- [ ] **Step 4: Run** `npm run e2e -- auth`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: sign-in, route guard and app shell`.

---

### Task 5: Day log domain

**Files:**
- Create: `src/lib/log.ts`
- Test: `tests/unit/log.test.ts`

**Interfaces:**
- Consumes: `DB`, `logSlots`, `logNotes`, `users`, `ValidationError`
- Produces: `SLOTS = ['wake','breakfast','nap','lunch','snack','dinner'] as const`; `type SlotKey`; `AMOUNTS`; `NOTE_KINDS`; `type SlotEntry = { slot: SlotKey; time: string; endTime: string | null; food: string | null; amount: string | null; byName: string }`; `type NoteEntry = { id: number; time: string; kind: string; text: string; byName: string }`; `type DayLog = { date: string; slots: Record<SlotKey, SlotEntry | null>; notes: NoteEntry[] }` (notes sorted by time); `getDayLog(db, date: string): Promise<DayLog>`; `saveSlot(db, input: { date: string; slot: SlotKey; time: string; endTime?: string; food?: string; amount?: string }, userId: number, today: string): Promise<void>`; `clearSlot(db, date: string, slot: SlotKey): Promise<void>`; `saveNote(db, input: { id?: number; date: string; time: string; kind: string; text: string }, userId: number, today: string): Promise<void>`; `deleteNote(db, id: number): Promise<void>`; `recentFoods(db, limit?: number): Promise<string[]>`

- [ ] **Step 1: Write the failing tests:**
  - `saveSlot` for breakfast (`'07:30'`, `'Oatmeal with blueberries'`, `'Most'`) as Mom, then `getDayLog` → `slots.breakfast` has `byName: 'Mom'` and `slots.snack === null`.
  - Saving lunch as Mom and then as Selina (the concurrency case) leaves one row, with `byName: 'Selina'` and the second food.
  - A meal with blank food → `ValidationError` with field `'food'` and message `'Write what he ate, like "banana and yogurt".'`.
  - A nap `13:00`–`12:30` → `ValidationError` with field `'endTime'` and message `'The nap has to end after it starts.'`.
  - `date: '2026-11-26'` with `today: '2026-11-25'` → `ValidationError('You can't log a day that hasn't happened yet.')`. `date: '2026-11-25'` with `today: '2026-11-25'` is accepted.
  - An unknown slot, kind or amount → `ValidationError`.
  - `saveNote` with blank text → `'Add a few words so the others know what happened.'`.
  - Notes come back sorted by time. `deleteNote` removes one.
  - `clearSlot` returns the slot to `null`.
  - `recentFoods` after meals `'Pasta with peas and cheese'` and `'Yogurt and banana'` includes `'Pasta'`, `'Peas'`, `'Cheese'`, `'Yogurt'` and `'Banana'` (split on commas, " and ", " with "; trimmed; capitalized; deduped; most recent first). It's padded to `limit` (default 10) from `['Banana','Yogurt','Oatmeal','Toast','Avocado','Berries','Cheese','Pasta','Chicken','Rice']`.
- [ ] **Step 2: Run** `npm test -- log`. Expected: FAIL.
- [ ] **Step 3: Implement** with zod schemas per slot kind. Upsert slots with `onConflictDoUpdate` on (`date`, `slot`). Join `users.name` for `byName`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: day log domain with validation and recent foods`.

---

### Task 6: Today screen

**Files:**
- Create: `src/app/(app)/page.tsx`, `src/app/actions/log.ts`, `src/components/today/{TileGrid,Tile,NotesList,TileSheet,NoteSheet,DayNav}.tsx`
- Test: `tests/e2e/today.spec.ts`

**Interfaces:**
- Consumes: `requireUser`, `getDayLog`, `saveSlot`, `clearSlot`, `saveNote`, `deleteNote`, `recentFoods`, `todayNY`, `fmt*`, `Sheet`, `useToast`
- Produces: server actions `saveSlotAction(form: FormData): Promise<ActionResult>`, `clearSlotAction(date: string, slot: SlotKey): Promise<ActionResult>`, `saveNoteAction(form: FormData)`, `deleteNoteAction(id: number)`. Each calls `requireUser()`, passes `todayNY()`, maps `ValidationError` to `{ ok: false, field, message }` and calls `revalidatePath('/')`. The page reads `?date=YYYY-MM-DD`, defaults to `todayNY()`, and treats a future date as today. Task 9 adds the NowCard slot above the progress line.

- [ ] **Step 1: Write the failing e2e test:**
  - Signed in as Dad: the progress line reads "0 of 6 logged".
  - Tap the "Add Breakfast" tile, type "Oatmeal", choose "Most", Save. The toast "Breakfast saved. Everyone can see it now." appears, the tile shows "Oatmeal" and "ate most" and "Dad", and progress reads "1 of 6 logged".
  - Tap Breakfast, then Remove. The tile is back to "Add".
  - Nap with Fell asleep 13:00 and Woke up 14:30 shows "Slept 1h 30m" before saving. After saving the tile shows "1h 30m", and progress shows "Napped 1h 30m".
  - "+ Add something else" with Milestone and "Said truck" saves to the "Anything else" list.
  - Saving a meal with empty food shows the error text inline.
  - The ‹ button goes to "Yesterday", and from yesterday › returns to "Today". On today, › is disabled.
- [ ] **Step 2: Run** `npm run e2e -- today`. Expected: FAIL.
- [ ] **Step 3: Implement** by porting the mockup's `viewToday`, `tile`, `noteRow`, `openTileSheet` and `openNoteSheet` markup and copy. Day navigation uses links to `/?date=`. Sheets are client components that submit to the server actions, close on `ok`, toast `"<Label> saved. Everyone can see it now."` / `"Saved. Everyone can see it now."` / `"Removed"`, and show `message` under the field named by `field` otherwise. Food chips come from `recentFoods`.
- [ ] **Step 4: Run** `npm run e2e -- today`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: Today screen with tiles, notes and day navigation`.

---

### Task 7: Coverage logic

**Files:**
- Create: `src/lib/schedule/coverage.ts`
- Test: `tests/unit/coverage.test.ts`

**Interfaces:**
- Consumes: `toMin`, `dayOfWeek`
- Produces: `type ShiftView = { id: number; date: string; personId: number; personName: string; color: string; start: string; end: string }`; `type CoverageRules = { days: number[]; start: string; end: string }`; `needsCoverage(date: string, rules: CoverageRules, daysOff: Map<string, string>): boolean`; `gapsFor(shifts: { start: string; end: string }[], rules: CoverageRules, needed: boolean): Array<[number, number]>` (minutes); `nowWithEzra(shifts: ShiftView[], nowMin: number): { current: ShiftView | null; next: ShiftView | null }`; `weeklyHours(shifts: ShiftView[]): Array<{ personName: string; color: string; minutes: number }>` (sorted by minutes, descending)

- [ ] **Step 1: Write the failing tests** (`rules = { days: [1,2,3,4,5], start: '08:00', end: '18:30' }`):

```ts
test('one gap after the day shift', () => {
  expect(gapsFor([{ start: '08:00', end: '16:00' }], rules, true)).toEqual([[960, 1110]]);
});
test('overlapping and out-of-window shifts make no false gaps', () => {
  expect(gapsFor([{ start: '07:00', end: '09:00' }, { start: '08:00', end: '16:00' }, { start: '15:00', end: '20:00' }], rules, true)).toEqual([]);
});
test('middle gap and empty day', () => {
  expect(gapsFor([{ start: '08:00', end: '12:00' }, { start: '13:00', end: '18:30' }], rules, true)).toEqual([[720, 780]]);
  expect(gapsFor([], rules, true)).toEqual([[480, 1110]]);
  expect(gapsFor([], rules, false)).toEqual([]);
});
test('weekends and days off need no coverage', () => {
  const off = new Map([['2026-11-26', 'Thanksgiving']]);
  expect(needsCoverage('2026-11-25', rules, off)).toBe(true);
  expect(needsCoverage('2026-11-26', rules, off)).toBe(false);
  expect(needsCoverage('2026-11-28', rules, off)).toBe(false);
});
```

  Also:
  - `nowWithEzra` at 14:30 with Lauren 08:00–16:00 and Mom 16:00–18:30 → current Lauren, next Mom.
  - At 07:00 → current `null`, next Lauren.
  - At 19:00 → both `null`.
  - `weeklyHours` for four 8 h Lauren shifts and two 2.5 h Selina shifts → `[{ Lauren, 1920 }, { Selina, 300 }]`.
- [ ] **Step 2: Run** `npm test -- coverage`. Expected: FAIL.
- [ ] **Step 3: Implement.** For `gapsFor`, port the mockup's `gapsFor`: clip each shift to the window, sort by start, sweep a cursor and emit the uncovered spans.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: coverage gaps, who-is-with-Ezra and weekly hours`.

---

### Task 8: Schedule data (shifts, days off, copy week)

**Files:**
- Create: `src/lib/schedule/repo.ts`, `src/lib/settings.ts`
- Test: `tests/unit/schedule-repo.test.ts`

**Interfaces:**
- Consumes: `DB`, tables, `ShiftView`, `CoverageRules`, `addDays`, `ValidationError`
- Produces: `getSettings(db): Promise<{ ezraBirthdate: string | null; rules: CoverageRules }>`; `updateSettings(db, input: { ezraBirthdate?: string | null; days?: number[]; start?: string; end?: string }): Promise<void>` (end must be after start: `'The end time needs to be after the start time.'`); `type WeekView = { weekStart: string; days: Array<{ date: string; shifts: ShiftView[]; dayOff: string | null }> }`; `getWeek(db, weekStart: string): Promise<WeekView>`; `getDayShifts(db, date: string): Promise<ShiftView[]>`; `addShift(db, input: { date: string; personId: number; start: string; end: string }): Promise<number>`; `updateShift(db, id: number, input: same): Promise<void>`; `deleteShift(db, id: number): Promise<void>`; `setDayOff(db, date: string, label: string): Promise<void>`; `clearDayOff(db, date: string): Promise<void>`; `copyWeek(db, src: string, targets: string[], mode: 'replace' | 'fill'): Promise<void>`

- [ ] **Step 1: Write the failing tests:**
  - `addShift` with end ≤ start → `ValidationError('The end time needs to be after the start time.')`.
  - `getWeek('2026-11-23')` returns 7 days Mon–Sun. Shifts are sorted by start, with `personName` and `color` joined.
  - `copyWeek(src, [next], 'replace')` makes next week's shifts equal the source's (same people and times, new ids) and wipes target days that had other shifts.
  - `'fill'` leaves a target day that already has a shift unchanged and fills only the empty days.
  - A day off on the source Thursday or on the target Thursday → that pair is skipped in both modes.
  - Copying to 4 targets runs in a single transaction: a forced failure on the 3rd target (e.g. a deleted personId) leaves all targets unchanged.
  - `updateSettings({ start: '18:00', end: '08:00' })` throws.
- [ ] **Step 2: Run** `npm test -- schedule-repo`. Expected: FAIL.
- [ ] **Step 3: Implement.** `copyWeek` runs inside `db.transaction`, looping over day offsets 0–6.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: shifts, days off, copy week and settings data`.

---

### Task 9: Caretakers screen and "With Ezra now"

**Files:**
- Create: `src/app/(app)/calendar/caretakers/page.tsx`, `src/app/actions/schedule.ts`, `src/components/caretakers/{WeekNav,CoverageStatus,DayRow,CoverageBar,ShiftSheet,CopyWeekSheet,DayOffSheet,Hours,EmptyWeek}.tsx`, `src/components/today/NowCard.tsx`, `src/components/CalendarTabs.tsx`
- Modify: `src/app/(app)/page.tsx` (NowCard on today only)
- Test: `tests/e2e/caretakers.spec.ts`

**Interfaces:**
- Consumes: `getWeek`, `getDayShifts`, `getSettings`, `needsCoverage`, `gapsFor`, `nowWithEzra`, `weeklyHours`, `addShift`/`updateShift`/`deleteShift`, `copyWeek`, `setDayOff`/`clearDayOff`, `listPeople` (Task 10; until then read `schedulePeople` directly), `requireFamily`, `weekStartOf`, `todayNY`, `minutesNowNY`
- Produces: actions `saveShiftAction(form: FormData)`, `deleteShiftAction(id: number)`, `copyWeekAction(form: FormData)` (fields `src`, `target` = `next|next4|pick`, `pick[]`, `mode`), `copyPrevWeekAction(weekStart: string)`, `setDayOffAction(form: FormData)`, `clearDayOffAction(date: string)`. All call `requireFamily()` and `revalidatePath('/calendar/caretakers')` and `revalidatePath('/')`. The page reads `?week=YYYY-MM-DD` (snapped to Monday and clamped to [this week − 1, this week + 8]).

- [ ] **Step 1: Write the failing e2e test** (as Dad):
  - An empty week shows "Nothing planned yet".
  - "Add shift": Dad, today's weekday, 08:00–16:00 → a day row shows "Dad" and "8:00 am – 4:00 pm" and "8h", plus a gap row "Nobody 4:00 – 6:30 pm" with "Fill".
  - Tapping Fill opens the shift sheet prefilled with 16:00–18:30. Saving makes the gap row disappear, and the status chip shows "All covered" if no other gaps remain on weekdays (add shifts or days off as needed to reach it, or assert the gap count decreases by 1).
  - "Copy week" → Next week → "Copy schedule" shows the toast "Copied to <range>". Navigating › to "Next week" shows the same shifts.
  - Tapping a weekday header (family only) → "Mark as day off" with label "Thanksgiving" collapses that day to "Thanksgiving · day off" and removes its gaps.
  - Today: the NowCard shows "With Ezra now" and links to `/calendar/caretakers`.
- [ ] **Step 2: Add the caretaker case** to the same spec (it needs Task 10's people UI, so mark it `test.fixme` until Task 10 removes the marker). Signed in as a caretaker, the Caretakers screen shows no "Add shift" or "Copy week", tapping a shift opens nothing, and a direct POST of `saveShiftAction` returns `{ ok: false, message: 'Only family members can change this.' }`.
- [ ] **Step 3: Run** `npm run e2e -- caretakers`. Expected: FAIL.
- [ ] **Step 4: Implement** by porting the mockup's `caretakersView`, `dayRow`, `seg`, `openShiftSheet` and `openCopySheet` markup, scale labels and copy.
  - Calendar tabs = the mockup's `.seg` control (Classes / Caretakers) as links.
  - Weekend or day-off rows with no shifts collapse to "Weekend · nobody needed" or "<label> · day off".
  - Copy sheet targets: next week, next 4 weeks, or pick from the next 6. Mode: "Replace them" (default) or "Only fill empty days". It shows the note "Days off are skipped."
  - Empty week: "Copy last week here" and "Or add one shift".
  - NowCard text ported from `nowInfo`/`nowCard`, using `minutesNowNY()`.
  - Hide every family-only control when `!isFamily(user)`.
- [ ] **Step 5: Run** `npm run e2e`. Expected: PASS (except the fixme case).
- [ ] **Step 6: Commit** `feat: caretaker schedule screen and who-is-with-Ezra card`.

---

### Task 10: People, settings and the account sheet

**Files:**
- Create: `src/lib/people.ts`, `src/app/actions/people.ts`, `src/components/account/{AccountSheet,PeopleSection,PersonSheet,SettingsSection,PasswordSection}.tsx`
- Modify: `src/components/AvatarButton.tsx` (opens AccountSheet; the avatar letter is the user's initial), `tests/e2e/caretakers.spec.ts` (remove the `fixme` marker)
- Test: `tests/unit/people.test.ts`, `tests/e2e/account.spec.ts`

**Interfaces:**
- Consumes: `DB`, `hashPassword`, `verifyPassword`, `deleteUserSessions`, `PERSON_COLORS`, `updateSettings`, `getSettings`, `requireUser`, `requireFamily`
- Produces: `type PersonView = { personId: number; name: string; color: string; userId: number | null; email: string | null; role: 'family' | 'caretaker' | null; disabled: boolean }`; `listPeople(db): Promise<PersonView[]>`; `createAccount(db, input: { name: string; email: string; role: 'family' | 'caretaker'; password: string }): Promise<number>` (also creates the schedule person, with the least-used color from `PERSON_COLORS`); `resetPassword(db, userId: number, password: string): Promise<void>` (also deletes their sessions); `changeOwnPassword(db, userId: number, current: string, next: string): Promise<void>`; `setRole(db, userId: number, role): Promise<void>`; `disableAccount(db, userId: number): Promise<void>` (sets `disabledAt` and deletes sessions; schedule person kept); `addSchedulePerson(db, { name: string; color: string }): Promise<number>`; `updateSchedulePerson(db, id: number, { name?: string; color?: string }): Promise<void>`; matching actions in `src/app/actions/people.ts`, all family-only except `changeOwnPasswordAction` (sign-out stays in `src/app/actions/auth.ts` from Task 4)

- [ ] **Step 1: Write the failing unit tests:**
  - `createAccount` with `' Mom@Example.com '` stores `'mom@example.com'`. A second account with `'MOM@example.com'` → `ValidationError('Someone already uses that email.')`.
  - A password shorter than 8 → `'Use at least 8 characters.'`.
  - Colors are assigned least-used first.
  - `setRole` or `disableAccount` on the only family member → `ValidationError('At least one person needs family access.')`.
  - `disableAccount` makes that user's `validateSession` return `null`, and their past log entries still show their name.
  - `changeOwnPassword` with the wrong current password → `"That's not your current password."`.
  - `resetPassword` lets the new password sign in and the old one fail.
- [ ] **Step 2: Write the failing e2e test** (`account.spec.ts`):
  - As Dad: avatar → Family shows Dad.
  - "Add someone": Selina, `selina@test.local`, Caretaker, `starter-pass-1` → listed with role "Caretaker".
  - Settings: set Ezra's birthdate, change coverage end to 18:00 → the Caretakers line reads "Needed weekdays, 8:00 am – 6:00 pm".
  - Sign out, then sign in as Selina: the account sheet shows no People or Settings sections, and the "Put Ezra on your Home Screen" hint is visible.
  - Selina changes her own password, signs out, and signs in with the new one.
- [ ] **Step 3: Run** `npm test -- people && npm run e2e -- account`. Expected: FAIL.
- [ ] **Step 4: Implement** the account sheet as the mockup's `openAccount`, plus:
  - **People** (family): rows with color avatar, name, email and role. Tapping a row opens PersonSheet (name, color, role, "Reset password", "Remove access" with an in-sheet confirm step, since `confirm()` isn't allowed). There's also "Add someone" (account) and "Add a name for the schedule only".
  - **Settings** (family): Ezra's birthdate, coverage days (Mon–Sun chips), start and end.
  - **Password** (everyone): current and new.
  - Sign out.
- [ ] **Step 5: Run** `npm test && npm run e2e`. Expected: all PASS, including the caretaker case from Task 9.
- [ ] **Step 6: Commit** `feat: people management, settings and account sheet`.

---

### Task 11: Home-screen install (PWA)

**Files:**
- Create: `src/app/manifest.ts`, `src/app/icons/[size]/route.tsx`, `src/app/apple-icon.tsx`
- Modify: `src/app/layout.tsx` (`appleWebApp: { capable: true, title: 'Ezra', statusBarStyle: 'default' }`)
- Test: `tests/e2e/pwa.spec.ts`

**Interfaces:**
- Produces: `/manifest.webmanifest`; `/icons/192` and `/icons/512` PNG (ImageResponse); `/apple-icon` 180×180 PNG

- [ ] **Step 1: Write the failing test.** The manifest must have `name` `'Ezra'`, `short_name` `'Ezra'`, `display` `'standalone'`, `start_url` `'/'`, `background_color` `'#FBF6EE'`, `theme_color` `'#FBF6EE'`, and icons with sizes `'192x192'` and `'512x512'` (`purpose` `'any'`). `/icons/512` returns `200` `image/png` without a session cookie. The signed-out `/signin` HTML contains `<link rel="apple-touch-icon"`.
- [ ] **Step 2: Run** `npm run e2e -- pwa`. Expected: FAIL.
- [ ] **Step 3: Implement.** The icon is the mockup's sign-in logo mark (rising sun, sage-ink strokes) centered on a sage-soft rounded square, drawn with `next/og` `ImageResponse`.
- [ ] **Step 4: Run** `npm run e2e`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: installable home-screen app with icons and manifest`.

---

### Task 12: Production build, migrations and setup guide

**Files:**
- Create: `scripts/migrate.ts`, `docs/setup.md`
- Modify: `package.json` (`"build": "tsx scripts/migrate.ts && next build"`, `"db:generate": "drizzle-kit generate"`), `README.md`
- Test: `tests/unit/migrate-script.test.ts`

**Interfaces:**
- Consumes: `runMigrations`, `ensureSettings`, `ensureOwner`
- Produces: `migrateAndBootstrap(db: DB, env: NodeJS.ProcessEnv): Promise<{ migrated: boolean; owner: 'created' | 'exists' | 'skipped' }>` exported from `scripts/migrate.ts`. The CLI entry runs it only when `DATABASE_URL` is set **and** `VERCEL_ENV` is `'production'` or unset (local), and otherwise logs `Skipping migrations (no DATABASE_URL or preview build)`.

- [ ] **Step 1: Write the failing test.** On a PGlite test db with owner env set, `migrateAndBootstrap` returns `{ migrated: true, owner: 'created' }`, and a second run returns `owner: 'exists'`.
- [ ] **Step 2: Run** `npm test -- migrate-script`. Expected: FAIL.
- [ ] **Step 3: Implement** the script.
- [ ] **Step 4: Write `docs/setup.md`**, the owner's checklist in plain words (spec §8, adapted to Part 1):
  1. Vercel → Add New Project → import `baby_org`, project name `ezras-day` (or the closest available).
  2. Storage → add Neon Postgres to the project (free).
  3. Settings → Environment Variables (Production): `OWNER_NAME` (Dad's display name), `OWNER_EMAIL`, `OWNER_PASSWORD`.
  4. Deploy, open the address, sign in.
  5. Delete `OWNER_PASSWORD` from Vercel and change your password in the app.
  6. Avatar → set Ezra's birthdate, add Mom, Lauren (family) and Selina (caretaker), and text each their link and starting password with the home-screen steps.

  Link it from `README.md`.
- [ ] **Step 5: Run** `npm test && npm run e2e && npm run build` (the build without `DATABASE_URL` must print the skip line and succeed). Expected: all PASS.
- [ ] **Step 6: Commit** `chore: production migrations on deploy and owner setup guide`.

---

## After Part 1

- Merge `feature/core-app` into `main` (Vercel deploys `main`). The owner follows `docs/setup.md`.
- Part 2 plan (classes, places sheet, page watch, age overrides, the `bpl-branch`/`young-ethels`/`tribe-events` adapters, daily cron, seeding `seed/manual-classes.json`) gets written next, from spec §6.2, §6.4, §7.2–7.3 and §7.5 phases 2–4.
