/** Day-log names and shapes, with no database code, so screens can import them cheaply. */
import { toMin } from './time';

export const SLOTS = ['wake', 'breakfast', 'lunch', 'snack', 'dinner'] as const;
export type SlotKey = (typeof SLOTS)[number];
export const MEAL_SLOTS: readonly SlotKey[] = ['breakfast', 'lunch', 'snack', 'dinner'];
export const AMOUNTS = ['All', 'Most', 'Some', 'A little', 'None'] as const;
export const NOTE_KINDS = ['Note', 'Health', 'Medicine', 'Diaper', 'Milestone'] as const;

export type SlotEntry = { slot: SlotKey; time: string; food: string | null; amount: string | null; byName: string };
export type NapEntry = { id: number; start: string; end: string; byName: string };
export type NoteEntry = { id: number; time: string; kind: string; text: string; byName: string };
export type DayLog = { date: string; slots: Record<SlotKey, SlotEntry | null>; naps: NapEntry[]; notes: NoteEntry[] };

/** Total sleep across the day's naps, in minutes. */
export function napMinutes(naps: { start: string; end: string }[]): number {
  return naps.reduce((sum, n) => sum + toMin(n.end) - toMin(n.start), 0);
}
