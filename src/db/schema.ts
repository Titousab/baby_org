import { sql } from 'drizzle-orm';
import { check, date, integer, pgTable, primaryKey, serial, text, timestamp } from 'drizzle-orm/pg-core';

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
    endTime: text('end_time'),
    food: text('food'),
    amount: text('amount'),
    updatedBy: integer('updated_by')
      .notNull()
      .references(() => users.id),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.date, t.slot] })],
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
});
