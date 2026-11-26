# Ezra's caretaker app: design

Date: 2026-11-25
Status: approved by owner, 2026-11-25

## 1. Intent

Ezra is a toddler (1–2 years old) in Park Slope, Brooklyn. Four adults look after him:

| Person | Who | App role |
|---|---|---|
| Dad (the owner of this project) | parent | family |
| Mom | parent | family |
| Lauren | grandmother | family |
| Selina | nanny | caretaker |

Today they coordinate by text. They want one private web app, saved to each phone's home screen, where they can:

1. **Log Ezra's day** (wake-up time, meals, nap, anything else) so whoever has him next knows how the day has gone.
2. **See his classes** from every place he can attend, combined into one calendar and filtered to his age, with a link to each place's own booking page. Also see a few nearby things that aren't connected (library storytime, park programs).
3. **Plan who's with him**, week by week, and spot hours that nobody is covering. Copying a week to later weeks should be one action.

Success means all four people use it daily without help, and logging something takes a few taps.

## 2. Visual reference

The approved look and behavior is **Option A ("Soft tiles")** in the clickable mockup:

- File in repo: `docs/mockups/ezra-mockup.html` (open it in a browser; the A/B/C switcher at the top must be on **A**)
- Published copy: https://claude.ai/artifact/HhZbSAHoBDCmoZ8VQJm3ss (private to the owner)

Options B and C in the same file were rejected. The real app should match Option A's layout, colors (warm cream, sage, peach, sky, lavender, butter), type (Fredoka headings, Figtree body, body text at 17px or larger), light and dark themes, bottom sheets for every form, and its copy. The mockup's sample data, its `NOW` constant and the "Mockup option" strip are not part of the app.

Differences from the mockup that are already decided:

- Sign-in is **email + password**, not an emailed code (see §5).
- People are shown by real first name. Lauren is the grandmother, so there is no separate "Grandma". Dad's and Mom's display names will be entered at setup.
- The account sheet ("D" avatar) also holds people management and settings (see §6.5).

## 3. Goals, non-goals, anti-goals

**Goals (v1)**

- Daily log with six fixed slots (Woke up, Breakfast, Nap, Lunch, Snack, Dinner) plus free-form entries ("Anything else") of kind Note, Health, Medicine, Diaper or Milestone. Anyone signed in can add, edit or delete any entry. Each entry shows who last saved it.
- Browse past days. Future days can't be logged.
- Classes: a 7-day agenda from connected places, filtered to Ezra's age by default, with a place filter, a "show older kids" toggle and a Book button that opens the provider's page in a new tab.
- Nearby ideas for Park Slope from public event calendars, clearly marked "Not connected".
- Caretaker schedule: shifts per day, coverage gaps flagged inside a configurable weekday window, a "Fill" shortcut on each gap, copy week, days marked as off, weekly hours per person, and the "With Ezra now" card on Today.
- Installable to the home screen on iPhone and Android, phone-first, also usable in a desktop browser.

**Non-goals (v1)**

- Push notifications, photos, booking or paying inside the app, multiple children, payroll, offline editing, native apps, chat.

**Anti-goals** (a failure even if it technically works)

- Logging takes more than a few taps, or Lauren needs help to use it.
- Anyone outside the four accounts can see any data.
- A monthly bill. It must fit free tiers.
- A wrong class shown as fitting Ezra's age, or a booking link that goes to the wrong place.

## 4. Constraints

- **Hosting:** owner's existing Vercel account on the free Hobby plan (personal, non-commercial use). Hobby cron jobs run at most once a day.
- **Web address (decided by owner):** the free `*.vercel.app` address, set by the Vercel project name at import (for example `ezras-day.vercel.app`, depending on what's available). It must not change after people install the app, because the home-screen icon and sign-in are tied to it.
- **Database (changed by owner, 2026-11-25):** Postgres on the owner's existing **Railway** account (Pro plan), so the family's data is under the owner's own control. Vercel reaches it through Railway's public connection address (`DATABASE_PUBLIC_URL`), set in Vercel as `DATABASE_URL`, over an encrypted connection.
- **iPhone home-screen apps don't share cookies with Safari.** People must sign in from inside the installed app, so sessions must last a long time (see §5).
- **Time zone:** everything is America/New_York. "Today", gap checks and class times all use that zone, whatever zone the phone is in.
- **Repo:** `github.com/Titousab/baby_org` (currently a README plus these docs). Vercel deploys from `main`.
- No other paid services or new third-party accounts in v1.

## 5. Accounts and sign-in (decided by owner)

- Email + password. There is no public sign-up page.
- A **family** member creates each account in the app (name, email, role, starting password) and texts the starting password to the person. A family member can reset anyone's password. Anyone can change their own password.
- The very first account (Dad, family role) is created by a one-time seed command run at setup, which reads the email, name and password from the command line or env, not from the repo.
- Sessions last **365 days, rolling** (extended on use) in an httpOnly, Secure, SameSite=Lax cookie. "Sign out" ends only that device's session.
- Failed sign-ins are rate-limited per email (for example, 5 tries then a 15-minute wait) with a plain message saying when to try again.

**Roles (decided by owner)**

| Action | family | caretaker (Selina) |
|---|---|---|
| View everything | yes | yes |
| Add, edit, delete log entries | yes | yes |
| Add, edit, delete shifts, copy weeks, mark days off | yes | no (read-only) |
| Manage people, reset passwords, edit settings and class places | yes | no |

The UI hides controls a caretaker can't use, and the server enforces the same rules.

## 6. What it does (screen by screen, matching mockup A)

### 6.1 Today

- Header "Ezra's day" with ‹ › day arrows. The › arrow is disabled on today.
- "With Ezra now" card (today only) shows the current shift, when it ends and who is next, from the schedule. Tapping it opens Calendar → Caretakers.
- Progress line: "N of 6 logged" (the nap and snack tiles count once there's at least one nap or snack), plus total nap length, plus "asleep now" while a nap is running today.
- Six tiles in two columns. An empty tile opens its add sheet. A filled tile shows the value and who saved it, and opens an edit sheet with Remove.
  - Woke up: one time.
  - Breakfast, Lunch, Dinner: what he ate (free text, with chips for recently used foods), how much (All, Most, Some, A little, None) and time.
  - Snack: **as many snacks as he eats** (changed by owner, 2026-11-26). Each snack has the same fields as a meal. The tile shows the latest snack's food and time, plus how much he ate when there's one snack or "N snacks" when there are more. Tapping it lists the day's snacks (each editable or removable) with "Add another snack", or goes straight to the form when there are none.
  - Nap: **as many naps as he takes** (changed by owner, 2026-11-25). The tile shows total sleep, plus the times when there's one nap or "N naps" when there are more. Tapping it lists the day's naps (each editable or removable) with "Add another nap", or goes straight to the form when there are none. Each nap has fell asleep and woke up times, with live duration.
    - **Logged as it happens** (changed by owner, 2026-11-26): a nap can be started with "He's asleep now" (the server's current time) or by typing when he fell asleep and leaving Woke up empty, and ended later with "He just woke up" or a typed time. Anyone can end a nap someone else started. While one is running today, the tile counts up ("Asleep 45m, since 1:05 pm") and tapping it opens that nap. The "now" buttons only appear on today. A running nap isn't in the total until it ends; one left without a wake-up time on an earlier day shows "No wake-up time yet" and is never shown as asleep.
- "Anything else": list of free entries sorted by time. "+ Add something else" opens a sheet with kind, details and time.
- Changes by others show up when the app is reopened or comes back into focus, and every 60 seconds while it's open. Live push isn't needed.

### 6.2 Calendar → Classes

- "N places connected" bar opens the places sheet (§6.4).
- Place filter chips, an "Right for Ezra: X–Y months" badge, then classes for the next 7 days grouped by day. Classes that have already started today are hidden.
- Each row: start time, class name, place (color dot), length, age range, **price when known** ("Free", "$45/class", "$480 semester"; requested by the owner), optional status ("3 spots left", "Waitlist", "Registration opens 24h before", "Full") when the source provides it, and **Book**, which opens the class's or place's booking URL in a new tab. When the price is unknown, leave it out. Don't show "price unknown".
- Age filter: Ezra's age in months on the class date (from his birthdate in settings) must fall inside the class's min–max months. Classes with no age range are shown with "Age not listed" rather than hidden. A "Show" link reveals classes for older kids, labeled "Older kids".
- Days marked as holidays with no classes show a "Most places are closed" note.
- "Nearby ideas" section (§7.3) at the bottom.

### 6.3 Calendar → Caretakers

- Week navigation. Weeks run Monday to Sunday, from last week up to 8 weeks ahead.
- "Needed weekdays, 8:00 – 6:30 pm" line (window editable in settings) and a status chip ("All covered" or "N gaps to fill").
- Copy week and Add shift buttons (family only).
- One row per day: coverage bar to scale, shifts (color dot, name, time range, hours), gap rows ("Nobody 4:00 – 6:30 pm" + Fill). Weekend days and days off with no shifts collapse to one line.
- A shift belongs to a **schedule person**. Each signed-in user is automatically a schedule person, and family members can also add people who don't have an account (a backup sitter, say). Each schedule person has a color.
- **Gaps** are only computed on weekdays that aren't marked off, inside the coverage window.
- **Days off:** a family member can mark a date as off with a label (e.g. "Thanksgiving"). No coverage is needed, and it shows as a tag.
- **Copy week sheet:** copy the shown week to next week, the next 4 weeks or chosen weeks (next 6). If a target week already has shifts, either replace them or only fill empty days. Days off are skipped on both sides.
- Empty week: "Copy last week here" and "Or add one shift".
- "Hours this week" per person.

### 6.4 Class places sheet (family)

- Lists each place with how its schedule arrives: "Updates automatically" (synced) or "Typed in by hand", plus the last successful update time and any sync error in plain words.
- Add a place: name, website/booking link, color. A family member can then either connect a sync source (if one is supported, §7.2) or type classes in by hand: name, place, day and time, length, ages, price, booking link, and optionally "repeats weekly until <date>".
- **Page watch** for hand-typed places: the daily job fetches the place's classes page (URL set per place) and, when its text has changed since last time, the places sheet shows "<Place> updated its classes page. Take a look." with a link and a "Done" button that clears it. This keeps hand-typed schedules from going stale without scraping sites that block it.

### 6.5 Account sheet

- Everyone: their name and email, change password, "Put Ezra on your Home Screen" instructions, sign out.
- Family only:
  - **People:** list of accounts and schedule people, add account (name, email, role, starting password), reset password, change role, remove access (deleting an account keeps their past entries and shifts, attributed by name), add or edit schedule people and colors.
  - **Settings:** Ezra's birthdate, coverage window (days and hours).

### 6.6 Sign in

- The mockup's sign-in layout, with email and password fields and "Sign in". Text under the button: "Forgot your password? Ask Dad, Mom or Lauren to reset it."

## 7. How it's built (builder's calls, already made)

The owner left the technical approach to us.

### 7.1 Approaches considered

| Approach | Trade-off | Verdict |
|---|---|---|
| **Next.js (App Router, TypeScript) on Vercel + Postgres** | Deploys from GitHub; the database was first Neon through Vercel, then moved to the owner's Railway account at the owner's request | **Chosen** |
| Next.js + Supabase (auth + database) | Ready-made auth, but another account, and its auth features aren't needed | Rejected |
| Node server + Postgres on Railway | Simple and long-running; the owner already pays for Railway, so its Postgres now holds the data, but the app itself stays on Vercel | Database only |

### 7.2 Stack and structure

- **Next.js** App Router with server components and server actions, **TypeScript**, **Drizzle ORM** with node-postgres (`pg`) in production and PGlite in dev and tests, and migrations checked into the repo.
- **Auth:** small in-house module, not a framework. Password hashes with bcrypt (cost ≥ 12) or argon2id, plus a `sessions` table holding a SHA-256 hash of a random token. Middleware redirects signed-out requests to `/signin`.
- **Styling:** port the mockup's CSS tokens and components (light and dark tokens, `prefers-color-scheme`). Fonts are self-hosted with `next/font` (Fredoka, Figtree).
- **PWA:** web app manifest (name "Ezra", `display: standalone`, theme colors), app icons including `apple-touch-icon`, and iOS status-bar meta. No service worker or offline mode in v1.
- **Class sync (as built, 2026-11-25):** no cron job and no extra secret. When someone opens Calendar → Classes and anything is due (a schedule last read more than 20 hours ago, a page check, or a library program whose ages aren't known yet), the page starts a sync in the background after it has been sent (Next.js `after()`). A family member can also tap **Sync now**. A run reads at most one page per website, keeps to each site's crawl delay (the library asks for 30 seconds), and only one run happens at a time (10-minute lock). Each source upserts class sessions for the next 14 days. A source that fails keeps its last good sessions and shows the error in the places sheet. Adapters produce: title, start, length, min/max age in months when known, booking URL, price text and status text when available.
- **Fetching rules:** identify honestly (a plain `User-Agent` naming the app, no browser impersonation), check `robots.txt`, fetch each site at most a handful of pages a day, and never work around a block (HTTP 403, bot challenge, login). A place that blocks automated reading is handled as hand-typed plus page watch.

### 7.2a The owner's class places (researched 2026-11-25)

| Place | Relevant for Ezra (12–24 mo) | How the schedule is published | Plan |
|---|---|---|---|
| **Brooklyn Public Library, Park Slope branch** (bklynlibrary.org/locations/park-slope) | Toddler Storytime (18 mo–3 yrs, Wed 11:15, 30 min, free; registration opens 24 h before, no waitlist), Babies & Books, All Ages Storytime. The owner says music and dance classes also happen here. | The branch page is plain HTML listing about 20 upcoming events, each linking to a detail page (`/calendar/<slug>-park-slope-library-YYYYMMDD-HHMMam`) that holds the age range ("for little ones, 18 months to 3 years") and registration text. The `discover.bklynlibrary.org` calendar is JavaScript-only, so skip it. | **Automatic** (`bpl-branch` adapter): read the branch page, then each new event page (cache by URL). Price "Free". Status from the registration text ("Registration opens 24h before", "Full"). Book = the event page. |
| **Young Ethel's** (youngethels.com) | "TRL: Toddler Request Live!", a family sing-along happy hour, Mondays 4:30 pm. No age, length or price given. | `/events` is plain HTML lines like `MON 11/30 - 4:30pm - TITLE (Category)`. No feed. | **Automatic** (`young-ethels` adapter): read `/events` and keep entries whose title mentions toddler, kid, family, baby or children, so new kids' events appear on their own. Age "Age not listed", length 60 min assumed and labeled "about 1 hr", Book = `/events`. |
| **The Bramble** (thebramble.space) | Space for ages 0–2: toddler music ("Let's Jam"), crawler classes, playgroups, open play. | Booking and schedule are on **Sawyer** (`hisawyer.com/the-bramble-space/...`), which refuses automated access. | **Hand-typed** classes (family enters the ones they care about, with price) plus **page watch** on `thebramble.space/classes`. Book = the matching Sawyer link from that page. |
| **Good Day Play Cafe** (591 5th Ave) | LIL Boppers toddler hip-hop, Thu 10:00 am, ages 1.5–3, followed by open play until noon. Open play daily 10–5. | Hand-edited Squarespace page (`/classes`, often stale). Bookings on Acuity (`gooddayplaycafe.as.me`, JavaScript-only). Some sign-ups are Google Forms. | **Hand-typed** plus **page watch** on `gooddayplaycafe.com/classes`. Book = the sign-up link listed for that class. |
| **Treasure Trunk Theatre**, Park Slope studio (179 4th Ave) | Semester or drop-in, Nov 12 – Jan 29: Storytime (Thu 10:00, 0–4 yrs), Open Play (Thu 11–1, 0–4 yrs), Sing-Along Adventure (Fri 9:30, 0–4 yrs), Toddler Time at the Trunk (Fri 10:30, 1–2 yrs). $10–$40 per class, with free trial. | **Sawyer** again. | **Hand-typed** plus **page watch** on `/classes-at-tt-park-slope/`. Book = that page. |

Seed these five places at setup with their colors, adapters and watch URLs. The hand-typed places start with no classes, and the family adds what they want.

**Starting classes for hand-typed places:** transcribed by Claude from the owner's screenshots into [`seed/manual-classes.json`](../../../seed/manual-classes.json) (done 2026-11-25 for The Bramble's December calendar, Good Day Play Cafe and Treasure Trunk Park Slope), one record per class using the `manual_classes` fields. The seed command loads that file, and is safe to re-run. Later changes are made in the app, or by sharing new screenshots for Claude to update the file.

**No logins to other sites are stored.** None of the five places needs one to show its schedule (Sawyer blocks everyone, signed in or not). Any future place that only shows its schedule to members stays hand-typed. *(Builder's call, following the privacy anti-goal.)*

### 7.2b Turning age text into months *(builder's call)*

The parser is conservative, because of the anti-goal about wrongly showing a class as fitting Ezra:

- Explicit months are taken as written: "18 months to 3 years" → 18–36, "6–24 mo" → 6–24.
- Year values are taken **as written**: "Ages 1–2" → 12–24, "0 mo – 1 yrs" → 0–12, "1.5–3 years" → 18–36. (Evidence: The Bramble lists Tummy Time as "0 mo – 1 yrs", which is clearly for babies up to 12 months.) This is also the safe direction for the anti-goal: a borderline class gets hidden rather than shown wrongly.
- "X+" or "X and up" → min X, no max. "Under X" → max X×12−1.
- Words without numbers ("walkers", "toddlers", "all ages") or anything unparseable → no range, shown as "Age not listed".
- **Family-editable age override:** on any class, a family member can choose "Edit ages" and set min/max months. It's stored per (place, class title), applies to every session with that title at that place, wins over parsed values and survives the daily sync. This covers "All Ages Storytime", Young Ethel's sing-along and any wrong guess.
- **Data freshness on clients:** `router.refresh()` on focus/visibility change and on a 60-second interval while visible.

### 7.3 Nearby ideas

Same sync pipeline, with places marked as ideas rather than connected places. Shown with a price tag ("Free", "$5") when the source provides one, and a Details link.

- **Brooklyn Public Library, Central Library** (Grand Army Plaza): the same `bpl-branch` adapter on `bklynlibrary.org/locations/central`, keeping only events whose detail page states an age range that includes Ezra's age, or that are tagged storytime, babies or toddlers.
- **Prospect Park Alliance** (prospectpark.org): public JSON API at `https://www.prospectpark.org/wp-json/tribe/events/v1/events` (The Events Calendar plugin), with fields `title`, `start_date`, `end_date`, `cost`, `url`, `description`, `categories` and `venue`, 10 per page. Use its date filters (`start_date`, `end_date`, `per_page`; check the parameter names during the build). Keep events whose title or description mentions kids, children, toddler, family or all ages, and drop those that say adults only. There's no kids category today, so expect few results.
- **NYC Parks** (nycgovparks.org) blocks automated access (HTTP 403), so **don't use it**.
- If ideas come up empty for a week, the section shows "No nearby ideas this week" rather than disappearing.

### 7.4 Data model (outline)

- `users`: id, name, email (unique, case-insensitive), password_hash, role (`family`, `caretaker`), schedule_person_id, created_at, disabled_at
- `sessions`: id, user_id, token_hash, created_at, last_used_at, expires_at
- `login_attempts`: email, count, locked_until
- `schedule_people`: id, name, color (one of the mockup's person colors), user_id (nullable)
- `log_slots`: date, slot (`wake`, `breakfast`, `lunch`, `dinner`), time, food, amount, updated_by, updated_at. Unique on (date, slot).
- `naps`: id, date, start_time, end_time (empty while he's asleep; at most one per day), created_by, updated_by, timestamps. Several per day.
- `snacks`: id, date, time, food, amount, created_by, updated_by, timestamps. Several per day.
- `log_notes`: id, date, time, kind, text, created_by, updated_by, timestamps
- `shifts`: id, date, schedule_person_id, start_time, end_time, timestamps. Shifts must end after they start and can't cross midnight.
- `days_off`: date, label
- `settings`: single row with ezra_birthdate, coverage_days (default Mon–Fri), coverage_start (08:00), coverage_end (18:30)
- `places`: id, name, website_url, color, kind (`class`, `idea`), watch_url (nullable), watch_hash, watch_changed_at (cleared by "Done")
- `sources`: id, place_id, adapter (`bpl-branch`, `young-ethels`, `tribe-events`), config (JSON), last_success_at, last_error
- `class_sessions`: id, place_id, source_id, external_id, title, starts_at, duration_min, age_min_months, age_max_months, booking_url, status_text, price_text. Upsert key (source_id, external_id). Sessions that disappear from a source's next successful read are deleted.
- `manual_classes`: id, place_id, title, first_date, start_time, duration_min, age_min_months, age_max_months, price_text, note (shown where a synced class shows its status), booking_url, repeats_weekly (bool), until_date (null = ongoing). Expanded into dated occurrences when read, and merged with `class_sessions` for display.
- `age_overrides`: place_id, title, age_min_months, age_max_months, updated_by. Unique on (place_id, lower(title)).

### 7.5 Build order *(builder's call)*

Ship as soon as phase 1 works, so the family can start logging and scheduling. Later phases deploy as they're finished.

1. Sign-in, people and roles, settings, Today log, Caretakers schedule, PWA install, deploy.
2. Classes screen with hand-typed classes, places sheet, page watch, age overrides.
3. Automatic adapters: `bpl-branch` (Park Slope), `young-ethels`.
4. Nearby ideas: `bpl-branch` (Central Library), `tribe-events` (Prospect Park Alliance).

## 8. Setup the owner will do (checklist delivered at the end)

1. Vercel: import `baby_org` from GitHub, naming the project so the address reads well (for example `ezras-day` → `ezras-day.vercel.app`).
2. Railway: add a PostgreSQL database to a project, and copy its public connection address into Vercel as `DATABASE_URL`.
3. Vercel → Settings → Environment Variables: add `DATABASE_URL` (Railway's public address) and the three `OWNER_*` values. No cron secret is needed: classes sync when the Classes screen is opened.
4. Run the migration and the one-time seed for the owner's own account (exact commands provided).
5. In the app: set Ezra's birthdate, add Mom, Lauren and Selina, then text each their starting password and the link, with home-screen instructions.

## 9. Open items

- Dad's and Mom's display names: asked at setup and editable in the app.
- Ezra's birthdate: entered in settings at setup.

## 10. Left to the builder

File layout, library versions, test strategy, component breakdown, loading and error states, exact rate-limit numbers, cron time, icon artwork (a simple mark in the mockup's style), and fine-tuning spacing and colors to match the mockup.
