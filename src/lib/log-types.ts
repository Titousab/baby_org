/** Day-log names and shapes, with no database code, so screens can import them cheaply. */
import { toMin } from './time';

export const SLOTS = ['wake', 'breakfast', 'lunch', 'dinner'] as const;
export type SlotKey = (typeof SLOTS)[number];
export const MEAL_SLOTS: readonly SlotKey[] = ['breakfast', 'lunch', 'dinner'];
export const AMOUNTS = ['All', 'Most', 'Some', 'A little', 'None'] as const;
export const NOTE_KINDS = ['Note', 'Health', 'Medicine', 'Diaper', 'Milestone'] as const;

export type SlotEntry = { slot: SlotKey; time: string; food: string | null; amount: string | null; byName: string };
/** A nap without an `end` is running: he's still asleep. */
export type NapEntry = { id: number; start: string; end: string | null; byName: string };
export type SnackEntry = { id: number; time: string; food: string; amount: string | null; byName: string };
export type NoteEntry = { id: number; time: string; kind: string; text: string; byName: string };
export type DayLog = {
  date: string;
  slots: Record<SlotKey, SlotEntry | null>;
  naps: NapEntry[];
  snacks: SnackEntry[];
  notes: NoteEntry[];
};

/** Total sleep across the day's finished naps, in minutes. A running nap counts once it ends. */
export function napMinutes(naps: { start: string; end: string | null }[]): number {
  return naps.reduce((sum, n) => (n.end ? sum + toMin(n.end) - toMin(n.start) : sum), 0);
}

/** The nap he's still asleep in, if any. */
export function runningNap<T extends { end: string | null }>(naps: T[]): T | undefined {
  return naps.find((n) => n.end === null);
}
