import { sql } from 'drizzle-orm';
import { boolean, check, date, integer, pgTable, primaryKey, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['family', 'caretaker'] }).notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  disabledAt: ts('disabled_at'),
});

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastUsedAt: ts('last_used_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
});

export const loginAttempts = pgTable('login_attempts', {
  email: text('email').primaryKey(),
  failures: integer('failures').notNull().default(0),
  lockedUntil: ts('locked_until'),
});

export const schedulePeople = pgTable('schedule_people', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  userId: integer('user_id')
    .unique()
    .references(() => users.id),
});

export const logSlots = pgTable(
  'log_slots',
  {
    date: date('date', { mode: 'string' }).notNull(),
    slot: text('slot').notNull(),
    time: text('time').notNull(),
    food: text('food'),
    amount: text('amount'),
    updatedBy: integer('updated_by')
      .notNull()
      .references(() => users.id),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.date, t.slot] })],
);

export const naps = pgTable(
  'naps',
  {
    id: serial('id').primaryKey(),
    date: date('date', { mode: 'string' }).notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id),
    updatedBy: integer('updated_by')
      .notNull()
      .references(() => users.id),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [check('nap_end_after_start', sql`${t.endTime} > ${t.startTime}`)],
);

export const logNotes = pgTable('log_notes', {
  id: serial('id').primaryKey(),
  date: date('date', { mode: 'string' }).notNull(),
  time: text('time').notNull(),
  kind: text('kind').notNull(),
  text: text('text').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id),
  updatedBy: integer('updated_by')
    .notNull()
    .references(() => users.id),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const shifts = pgTable(
  'shifts',
  {
    id: serial('id').primaryKey(),
    date: date('date', { mode: 'string' }).notNull(),
    personId: integer('person_id')
      .notNull()
      .references(() => schedulePeople.id),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [check('shift_end_after_start', sql`${t.endTime} > ${t.startTime}`)],
);

export const daysOff = pgTable('days_off', {
  date: date('date', { mode: 'string' }).primaryKey(),
  label: text('label').notNull(),
});

export const settings = pgTable('settings', {
  id: integer('id').primaryKey(),
  ezraBirthdate: date('ezra_birthdate', { mode: 'string' }),
  coverageDays: integer('coverage_days').array().notNull().default([1, 2, 3, 4, 5]),
  coverageStart: text('coverage_start').notNull().default('08:00'),
  coverageEnd: text('coverage_end').notNull().default('18:30'),
  /** Preset schedule names (Juju's House) are added once, ever, so renaming or tidying them sticks. */
  presetsSeeded: boolean('presets_seeded').notNull().default(false),
  /** The class places and the screenshot classes are added once, ever. */
  placesSeeded: boolean('places_seeded').notNull().default(false),
  /** When a class sync started, so two people opening Classes don't run two at once. */
  syncStartedAt: ts('sync_started_at'),
});

/* ---------- Classes (Part 2) ---------- */

export const places = pgTable('places', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  kind: text('kind', { enum: ['class', 'idea'] }).notNull(),
  websiteUrl: text('website_url'),
  bookingUrl: text('booking_url'),
  watchUrl: text('watch_url'),
  watchHash: text('watch_hash'),
  watchCheckedAt: ts('watch_checked_at'),
  watchChangedAt: ts('watch_changed_at'),
});

export const sources = pgTable('sources', {
  id: serial('id').primaryKey(),
  placeId: integer('place_id')
    .notNull()
    .references(() => places.id),
  adapter: text('adapter', { enum: ['bpl-branch', 'young-ethels', 'tribe-events'] }).notNull(),
  url: text('url').notNull(),
  lastSuccessAt: ts('last_success_at'),
  lastAttemptAt: ts('last_attempt_at'),
  lastError: text('last_error'),
});

/** What a program's own page says (library): ages, length, sign-up. Learned one page at a time. */
export const programInfo = pgTable(
  'program_info',
  {
    sourceId: integer('source_id')
      .notNull()
      .references(() => sources.id),
    title: text('title').notNull(),
    detailUrl: text('detail_url'),
    ageText: text('age_text'),
    ageMin: integer('age_min'),
    ageMax: integer('age_max'),
    durationMin: integer('duration_min'),
    statusText: text('status_text'),
    fetchedAt: ts('fetched_at'),
  },
  (t) => [primaryKey({ columns: [t.sourceId, t.title] })],
);

export const classSessions = pgTable(
  'class_sessions',
  {
    id: serial('id').primaryKey(),
    placeId: integer('place_id')
      .notNull()
      .references(() => places.id),
    sourceId: integer('source_id')
      .notNull()
      .references(() => sources.id),
    externalId: text('external_id').notNull(),
    title: text('title').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    startTime: text('start_time').notNull(),
    durationMin: integer('duration_min'),
    ageMin: integer('age_min'),
    ageMax: integer('age_max'),
    priceText: text('price_text'),
    statusText: text('status_text'),
    bookingUrl: text('booking_url'),
  },
  (t) => [unique('class_sessions_source_external').on(t.sourceId, t.externalId)],
);

export const manualClasses = pgTable('manual_classes', {
  id: serial('id').primaryKey(),
  placeId: integer('place_id')
    .notNull()
    .references(() => places.id),
  title: text('title').notNull(),
  firstDate: date('first_date', { mode: 'string' }).notNull(),
  startTime: text('start_time').notNull(),
  durationMin: integer('duration_min').notNull(),
  ageMin: integer('age_min'),
  ageMax: integer('age_max'),
  priceText: text('price_text'),
  note: text('note'),
  bookingUrl: text('booking_url'),
  repeatsWeekly: boolean('repeats_weekly').notNull().default(true),
  untilDate: date('until_date', { mode: 'string' }),
});

/** A family member's correction of a class's ages, kept across syncs. */
export const ageOverrides = pgTable(
  'age_overrides',
  {
    placeId: integer('place_id')
      .notNull()
      .references(() => places.id),
    titleKey: text('title_key').notNull(),
    ageMin: integer('age_min'),
    ageMax: integer('age_max'),
    updatedBy: integer('updated_by').references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.titleKey] })],
);

/** When each website was last asked for a page, to keep to its crawl delay. */
export const hostFetches = pgTable('host_fetches', {
  host: text('host').primaryKey(),
  lastFetchAt: ts('last_fetch_at').notNull(),
});
