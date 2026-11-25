# Ezra's App, Part 2 (Classes): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calendar → Classes shows the next 7 days of classes from Ezra's five places, filtered to his age, with prices, sign-up status and Book links, plus nearby ideas. Two places sync automatically, three are hand-typed (seeded from the owner's screenshots), and the hand-typed places get a page-change alert.

**Architecture:** Builds on Part 1 (Next.js 16, Drizzle, pg/PGlite). Pure parsers turn fetched HTML/JSON into events. A sync engine in `src/lib/classes/sync.ts` runs at most one request per website per run and records what it learned. The Classes page starts a sync in the background (`after()`) when anything is due, and family members also get **Sync now**. There is **no Vercel cron**.

**Tech Stack:** As Part 1. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-25-ezra-caretaker-app-design.md` §6.2, §6.4, §7.2–7.3, §7.4 (classes tables), §7.5 phases 2–4. **Visual source:** `docs/mockups/ezra-mockup.html` option A: `classesView`, `classRow`, `openPlaces`.

## Global Constraints

- New York dates and times throughout. Class times are stored as `date` + `HH:MM` local, like shifts.
- Ages are in months, **taken as written** (spec §7.2b): "18 months to 3 years" → 18–36, "1–2 yrs" → 12–24, "1.5-3 years" → 18–36, "0 mo – 1 yrs" → 0–12, "X+" → min only, words without numbers → unknown. Family overrides per (place, title) win.
- Ezra's age on a date comes from `settings.ezraBirthdate`. With no birthdate, nothing is filtered and the page says "Add Ezra's birthday (tap your initial → Settings) to see only classes for his age."
- Fetching: `User-Agent: EzraFamilyCalendar/1.0 (private family app)`. Obey `robots.txt` Disallow for `*`. **At most one request per website per sync run**, and never within that site's crawl delay (bklynlibrary.org: 30 s). Never retry on 403/429. A source keeps its last good classes when a fetch fails, and the error shows in the places sheet.
- A sync is due when a source's or watch's last success is more than 20 h old, or (BPL) a kids' program still lacks age info. A run is skipped if another started less than 10 minutes ago (`settings.syncStartedAt`).
- Family-only: Sync now, add/edit/delete hand-typed classes, add a place, Edit ages, mark a page change as seen. Caretakers see everything.
- Price shows only when known. Booking links open in a new tab (`target="_blank" rel="noopener"`).
- Copy follows the mockup and spec: "N places connected", "Right for Ezra: X–Y months", "Older kids", "Age not listed", "Most places are closed for <day off>.", "Nearby ideas" / "Not connected", "<Place> updated its classes page. Take a look."

## Review Focus

1. **A website changes its layout or is down:** the parser finds 0 events or throws. The source must keep its previous classes, show "Couldn't read the schedule. Showing what we had." with the time of the last success, and not crash the page. Pinned in Task 5.
2. **Ezra's birthday not set yet:** the page must still list everything, with the "Add Ezra's birthday" hint, not hide all classes. Pinned in Task 3.
3. **Ezra ages into or out of a class during the 7-day window:** the fit is computed on each class's own date. Pinned in Task 2.
4. **A hand-typed weekly class whose until-date has passed, or that started in the past:** only occurrences inside the window and on or before the until-date appear. Pinned in Task 3.
5. **Two people open Classes at the same moment:** only one sync runs, through the 10-minute lock. Pinned in Task 5.

---

## File Structure

```
src/db/schema.ts                    + places, sources, programInfo, classSessions, manualClasses, ageOverrides, hostFetches; settings.placesSeeded, settings.syncStartedAt
drizzle/0003_classes.sql            generated
src/lib/classes/places-seed.ts      PLACES_SEED (7 places with sources/watch URLs) + ensurePlaces(db) (+ loads seed/manual-classes.json once)
src/lib/classes/ages.ts             parseAgeText, ageInMonths, fitFor
src/lib/classes/manual.ts           expandManual (pure), CRUD for manual classes
src/lib/classes/list.ts             listClasses(db, today, nowMin) → ClassItem[] for 7 days (classes + ideas)
src/lib/classes/adapters/bpl.ts     parseBplListing(html), parseBplDetail(html)
src/lib/classes/adapters/young-ethels.ts parseYoungEthels(html)
src/lib/classes/adapters/tribe.ts   parseTribeEvents(json)
src/lib/classes/robots.ts           robotsAllows(txt, path), crawlDelay(txt)
src/lib/classes/sync.ts             runSync(db, fetcher, now, {force}) + isSyncDue(db, now)
src/app/actions/classes.ts          syncNowAction, saveManualClassAction, deleteManualClassAction, setAgeOverrideAction, clearAgeOverrideAction, markWatchSeenAction, addPlaceAction
src/app/(app)/calendar/classes/page.tsx  the screen (replaces placeholder), after() sync
src/components/classes/*.tsx        ClassesView, ClassSheet, ManualClassSheet, PlacesSheet
tests/fixtures/sources/*            real pages fetched 2026-11-25 (bpl-branch.html, bpl-detail.html, youngethels.html, tribe.json)
```

---

### Task 1: Tables and seeded places

**Files:** Modify `src/db/schema.ts`. Create `src/lib/classes/places-seed.ts`. Modify `src/lib/bootstrap.ts` callers (`src/db/client.ts`, `scripts/migrate.ts`). Test `tests/unit/places-seed.test.ts`.

**Interfaces:**
- Produces tables:
  - `places`: id, slug unique, name, color, kind `'class'|'idea'`, websiteUrl, bookingUrl, watchUrl, watchHash, watchCheckedAt, watchChangedAt
  - `sources`: id, placeId, adapter `'bpl-branch'|'young-ethels'|'tribe-events'`, url, lastSuccessAt, lastAttemptAt, lastError
  - `programInfo` pk(sourceId, title): ageMin, ageMax, ageText, durationMin, statusText, detailUrl, fetchedAt
  - `classSessions`: id, placeId, sourceId, externalId, title, date, startTime, durationMin, ageMin, ageMax, priceText, statusText, bookingUrl; unique(sourceId, externalId)
  - `manualClasses`: id, placeId, title, firstDate, startTime, durationMin, ageMin, ageMax, priceText, note, bookingUrl, repeatsWeekly, untilDate
  - `ageOverrides`: placeId, titleKey (lowercased trimmed title), ageMin, ageMax, updatedBy; pk(placeId, titleKey)
  - `hostFetches`: host pk, lastFetchAt
  - `settings`: + placesSeeded bool default false, + syncStartedAt timestamptz null
- Produces `ensurePlaces(db: DB): Promise<void>`. Run once (`placesSeeded` flag), it inserts:

| slug | name | color | kind | source adapter + url | watch url | booking url |
|---|---|---|---|---|---|---|
| bpl-park-slope | Park Slope Library | sage | class | bpl-branch `https://www.bklynlibrary.org/locations/park-slope` | – | (per event) |
| young-ethels | Young Ethel's | lav | class | young-ethels `https://youngethels.com/events` | – | `https://youngethels.com/events` |
| bramble | The Bramble | sky | class | – | `https://www.thebramble.space/classes` | `https://www.thebramble.space/classschedule` |
| good-day | Good Day Play Cafe | peach | class | – | `https://www.gooddayplaycafe.com/classes` | `https://www.gooddayplaycafe.com/classes` |
| treasure-trunk | Treasure Trunk Theatre | butter | class | – | `https://www.treasuretrunktheatre.com/classes-at-tt-park-slope/` | same |
| bpl-central | Central Library | sage | idea | bpl-branch `https://www.bklynlibrary.org/locations/central` | – | (per event) |
| prospect-park | Prospect Park | sage | idea | tribe-events `https://www.prospectpark.org/wp-json/tribe/events/v1/events` | – | (per event) |

  It then loads `seed/manual-classes.json`, mapping its `place` names "The Bramble", "Good Day Play Cafe" and "Treasure Trunk Theatre" to those slugs.

- [ ] **Step 1: Failing test.** `ensurePlaces` twice → 7 places, 3 sources, 13 manual classes. A renamed place isn't re-added. Bramble's watchUrl matches the table.
- [ ] **Step 2: Run** `npx vitest run tests/unit/places-seed.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Add the schema, `npx drizzle-kit generate --name classes`, then `ensurePlaces`. Call it after `ensurePresetPeople` in `client.ts` (dev) and in `migrateAndBootstrap`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS (update `migrate-script.test.ts` expectations if needed).
- [ ] **Step 5: Commit** `feat: class places, sources and seeded hand-typed classes`.

### Task 2: Ages

**Files:** Create `src/lib/classes/ages.ts`. Test `tests/unit/ages.test.ts`.

**Interfaces:** `parseAgeText(text: string): { min: number | null; max: number | null } | null`; `ageInMonths(birthdate: string, onDate: string): number` (whole months, counting the day of month); `fitFor(ages: { min: number | null; max: number | null } | null, months: number | null): 'fits' | 'older' | 'younger' | 'unknown'` (`'older'` = the class is for older kids).

- [ ] **Step 1: Failing tests.**
  - `parseAgeText('This program is for little ones, 18 months to 3 years, and their caregivers.')` → `{min:18,max:36}`
  - `'1 – 2 yrs'` → 12–24
  - `'Ages: 1.5-3 years old'` → 18–36
  - `'0 mo – 1 yrs'` → 0–12
  - `'3 mo – 1.5 yrs'` → 3–18
  - `'Ages 3+'` → `{min:36,max:null}`
  - `'Toddlers welcome'` → null
  - `ageInMonths('2025-06-10','2026-11-25')` → 17
  - `ageInMonths('2025-06-10','2026-12-09')` → 17
  - `ageInMonths('2025-06-10','2026-12-10')` → 18 (ages into an 18-month class mid-week)
  - `fitFor({min:18,max:36}, 17)` → `'younger'`; with 18 → `'fits'`; `fitFor({min:0,max:12}, 17)` → `'older'`; `fitFor(null, 17)` → `'unknown'`; `fitFor({min:12,max:24}, null)` → `'unknown'`
- [ ] **Step 2–4:** Run → FAIL, implement, run → PASS.
- [ ] **Step 5: Commit** `feat: read age ranges and Ezra's age in months`.

### Task 3: Hand-typed classes and the 7-day list

**Files:** Create `src/lib/classes/manual.ts`, `src/lib/classes/list.ts`. Test `tests/unit/class-list.test.ts`.

**Interfaces:**
- `expandManual(m: ManualClassRow, from: string, to: string): string[]`: dates within [from, to], ≥ firstDate, ≤ untilDate, weekly or once.
- `saveManualClass(db, input: { id?: number; placeId: number; title: string; firstDate: string; startTime: string; durationMin: number; ageMin: number | null; ageMax: number | null; priceText: string | null; note: string | null; bookingUrl: string | null; repeatsWeekly: boolean; untilDate: string | null }): Promise<number>`. Validates: title required ("Add the class name."), time `HH:MM`, duration 5–480, ages ≥ 0 with max ≥ min ("The oldest age has to be at least the youngest."), untilDate ≥ firstDate.
- `deleteManualClass(db, id)`.
- `setAgeOverride(db, placeId, title, min, max, userId)`, `clearAgeOverride(db, placeId, title)`.
- `type ClassItem = { key: string; placeId: number; placeName: string; color: string; kind: 'class' | 'idea'; title: string; date: string; start: string; durationMin: number | null; ageMin: number | null; ageMax: number | null; ageOverridden: boolean; priceText: string | null; statusText: string | null; bookingUrl: string | null; manualId: number | null }`
- `listClasses(db, today: string, nowMin: number): Promise<ClassItem[]>`: next 7 days (today..today+6), synced sessions plus manual occurrences. Ages: override, else session/program info. Classes starting before `nowMin` today are dropped. Sorted by date and start.

- [ ] **Step 1: Failing tests.**
  - Weekly from 2026-11-12 until 2027-01-28 (a Thursday): `expandManual` for 11-25..12-01 → `['2026-11-26']`.
  - Until-date 2026-11-19 → `[]`. A one-off on 12-07 inside 12-01..12-07 → `['2026-12-07']`.
  - `listClasses` at today 2026-11-25, 14:30: a synced session at 09:30 today is dropped, one at 15:30 kept. Merged and sorted. An override (12–24) replaces a session's 0–48.
  - A manual class starting 2026-12-24 doesn't show for today 2026-11-25.
  - With no birthdate, items come back unfiltered (filtering is in the UI).
- [ ] **Step 2–4:** FAIL, implement, PASS.
- [ ] **Step 5: Commit** `feat: hand-typed classes and the combined 7-day class list`.

### Task 4: Parsers for the three sources

**Files:** Create `src/lib/classes/adapters/{bpl,young-ethels,tribe}.ts`, `src/lib/classes/robots.ts`, `tests/fixtures/sources/*` (copied from the 2026-11-25 fetches). Test `tests/unit/adapters.test.ts`.

**Interfaces:**
- `type SourceEvent = { externalId: string; title: string; date: string; start: string; durationMin: number | null; url: string | null; priceText: string | null; statusText: string | null; ageText: string | null }`
- `parseBplListing(html: string, baseUrl: string): SourceEvent[]`: reads `.card` blocks. The link `/calendar/<slug>-YYYYMMDD-HHMMam|pm` gives date and time, `.card-title a` the title, `externalId` = the path. `priceText: 'Free'`. Keep only titles matching `/story|bab(y|ies)|toddler|music|sing|danc|play|kid|famil|preschool|rhyme|puppet|lap/i`.
- `parseBplDetail(html: string): { ageText: string | null; durationMin: number | null; statusText: string | null }`. The meta description holds the age phrase and registration. The duration comes from `<start> &ndash; <end>`. Status: "Registration opens 24 hours before" → `'Sign-up opens 24h before'`; "Advance registration is required" → `'Sign-up required'`; "reached capacity" → `'Full'`.
- `parseYoungEthels(html: string): SourceEvent[]`: day `<time dateTime="YYYY-MM-DD…" class="font-black">`, items `<time … class="font-bold">4:30pm</time>…<span class="block">TITLE<!-- --> (Category)</span>`. Keep titles matching `/toddler|kid|famil|bab(y|ies)|children/i`. durationMin 60, externalId `date + title`, url `https://youngethels.com/events`.
- `parseTribeEvents(json: string): SourceEvent[]`: skip categories Food/Volunteer/Wellness, keep when title+description matches `/all ages|famil|toddler|\bkids?\b|children|storytime/i`. Duration from start/end, `priceText` = cost.
- `robotsAllows(robotsTxt: string, path: string): boolean` (`User-agent: *` Disallow prefixes, longest Allow wins); `crawlDelaySeconds(robotsTxt: string): number`.

- [ ] **Step 1: Failing tests on the fixtures.**
  - BPL listing contains "Toddler Storytime" on 2026-11-25 at 11:15 and 2026-12-02 at 11:15, and "Babies & Books" 2026-12-02 10:30. Excludes "Yoga" and "Zumba". `externalId` starts with `/calendar/toddler-storytime-park-slope-library-2026112`.
  - BPL detail → ageText contains "18 months to 3 years", durationMin 30, statusText `'Sign-up opens 24h before'`.
  - Young Ethel's → one event, 2026-11-30 16:30, title starting "TRL: TODDLER REQUEST LIVE!", no "SUPER 8 IMPROV".
  - Tribe fixture → keeps "Introduction to Birdwatching Outings", drops Greenmarkets and "Sexual Health Mobile Medical Unit".
  - robots: the BPL fixture allows `/locations/park-slope` with crawl delay 30, and disallows `/admin/x`.
  - Every parser returns `[]` (doesn't throw) on `'<html></html>'`.
- [ ] **Step 2–4:** FAIL, implement, PASS.
- [ ] **Step 5: Commit** `feat: read the library, Young Ethel's and Prospect Park schedules`.

### Task 5: Sync engine

**Files:** Create `src/lib/classes/sync.ts`. Test `tests/unit/sync.test.ts`.

**Interfaces:**
- `type Fetcher = (url: string) => Promise<{ status: number; text: string }>`
- `isSyncDue(db, now: Date): Promise<boolean>`
- `runSync(db, fetch: Fetcher, now: Date, opts?: { force?: boolean }): Promise<{ ran: boolean; fetched: string[] }>`
  1. Lock: skip (`ran:false`) if `syncStartedAt` is within 10 min, otherwise set it, and clear it at the end.
  2. Build due tasks (listing for sources whose lastSuccessAt is more than 20 h old, or all with `force`; page watches likewise; one BPL detail per host for a programInfo without fetchedAt).
  3. Per host, take only the first due task, and only if `hostFetches` allows (crawl delay from robots, cached for the run). Robots disallowed → mark source error "This site asks apps not to read this page."
  4. Listing: parse, upsert classSessions in today..today+13 for that source, delete that source's sessions in the window that weren't seen. Insert programInfo rows for new titles (BPL). Record lastSuccessAt. Zero events on a page that previously had events counts as an error and keeps the old sessions.
  5. Detail: fill programInfo (ages from `parseAgeText(ageText)`), and update matching sessions' ages, duration and status by title.
  6. Watch: hash the page text with tags and whitespace stripped. Changed from a non-null previous hash → `watchChangedAt = now`.
  7. Errors set `lastError` with the message: "Couldn't read the schedule (HTTP 503). Showing what we had."
- `markWatchSeen(db, placeId)`.

- [ ] **Step 1: Failing tests** (fake fetcher over fixtures; time injected):
  - First run fetches robots + listing for each host once. After it, Toddler Storytime sessions exist with ages unknown.
  - Second run 1 min later on the BPL host: does nothing (crawl delay 30 s is fine, but lock 10 min blocks it). With the lock cleared and now + 31 s: fetches exactly one detail URL, and sessions get 18–36.
  - A 503 on the listing keeps existing sessions and sets lastError starting "Couldn't read the schedule".
  - A watch hash change sets watchChangedAt, and the first-ever check doesn't.
  - A robots Disallow on `/events` → no fetch of `/events`, and the error text is set.
  - Two concurrent `runSync` calls → one returns `ran:false`.
- [ ] **Step 2–4:** FAIL, implement, PASS.
- [ ] **Step 5: Commit** `feat: polite daily sync with page-change alerts`.

### Task 6: Classes screen and places sheet

**Files:** Replace `src/app/(app)/calendar/classes/page.tsx`. Modify `src/app/(app)/calendar/page.tsx` (redirect to `/calendar/classes`). Create `src/app/actions/classes.ts` and `src/components/classes/{ClassesView,ClassSheet,ManualClassSheet,PlacesSheet}.tsx`. Modify `package.json` `dev:e2e` (add `SYNC_DISABLED=1`). Test `tests/e2e/classes.spec.ts`.

**Interfaces:**
- Consumes `listClasses`, `fitFor`, `ageInMonths`, `getSettings`, `runSync`, `isSyncDue`, `saveManualClass`, `deleteManualClass`, `setAgeOverride`, `clearAgeOverride`, `markWatchSeen`.
- The page calls `after(() => runSync(...))` when `isSyncDue` and `SYNC_DISABLED` is unset.
- Server actions (family-only except none): `syncNowAction()`, `saveManualClassAction(form)`, `deleteManualClassAction(id)`, `setAgeOverrideAction(form)`, `clearAgeOverrideAction(placeId, title)`, `markWatchSeenAction(placeId)`, `addPlaceAction(form)` (name, website, color → kind class, hand-typed).

UI (port mockup `classesView`/`classRow`/`openPlaces`):
- Places bar "N places connected" with "Updated <time>" → PlacesSheet.
- Place chips. The age badge "Right for Ezra: X–Y months" shows Ezra's current age in months as "Ezra is N months" (or the birthday hint).
- Day groups, with the holiday note from `daysOff`.
- Rows: time, title, place, length, age, price, status, and a **Book** link (or "Details" for ideas).
- "N for older kids hidden. Show". Classes for younger kids are hidden too: they count in the same line, reading "N for other ages hidden".
- Nearby ideas section (kind `idea`), with "No nearby ideas this week" when empty.
- Tapping a row opens ClassSheet: details, Book, and for family "Edit ages" (min/max months) plus, for hand-typed classes, "Edit class" / "Delete".
- PlacesSheet lists each place with "Updates automatically · checked 6:02 am" / "Typed in by hand" / error text / "<Place> updated its classes page. Take a look." (link + Done). Family also gets **Sync now**, **Add a class** (ManualClassSheet: place, name, first day, time, length, youngest/oldest age in months, price, note, booking link, "Repeats every week until") and **Add a place**.

- [ ] **Step 1: Failing e2e** (as Dad, sync disabled):
  - Calendar opens on Classes.
  - Manage → Add a class: The Bramble, "Test Music Circle", today's date, 23:50, 30 min, 12–24 months, "$25", weekly → it appears under "Today" with "$25" and a Book link with `target=_blank`.
  - Tap it → Edit ages 36–60 → it disappears behind "1 for other ages hidden" (birthday set to 18 months ago in the test first). **Show** brings it back labeled "Older kids".
  - Delete it from its sheet.
  - The places sheet lists all 5 class places.
  - As the caretaker created in account.spec, there's no "Add a class" and no "Sync now".
- [ ] **Step 2–4:** FAIL, implement, PASS. Then run all unit and e2e tests.
- [ ] **Step 5: Commit** `feat: Classes screen, places sheet and hand-typed classes`.

### Task 7: Ship

- [ ] Update the spec (§7.2: lazy sync instead of cron) and README (Classes now live).
- [ ] Full suite, lint, build. Merge to `main` and push (Vercel deploys, and the deploy step seeds places and classes).
