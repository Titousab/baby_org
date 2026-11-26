import type { IconName } from '@/components/Icon';
import type { SlotKey } from '@/lib/log-types';

export type TileKey = SlotKey | 'nap' | 'snack';
export type TileDef = { key: TileKey; label: string; kind: 'time' | 'meal' | 'nap' | 'snack'; color: string; icon: IconName };
export type SlotTileDef = TileDef & { key: SlotKey };

/** The six daily tiles, in mockup order. Naps and snacks are lists; the others are one entry a day. */
export const TILES: TileDef[] = [
  { key: 'wake', label: 'Woke up', kind: 'time', color: 'butter', icon: 'sun' },
  { key: 'breakfast', label: 'Breakfast', kind: 'meal', color: 'peach', icon: 'bowl' },
  { key: 'nap', label: 'Nap', kind: 'nap', color: 'sky', icon: 'moon' },
  { key: 'lunch', label: 'Lunch', kind: 'meal', color: 'peach', icon: 'bowl' },
  { key: 'snack', label: 'Snack', kind: 'snack', color: 'sage', icon: 'apple' },
  { key: 'dinner', label: 'Dinner', kind: 'meal', color: 'peach', icon: 'bowl' },
];

export const DEFAULT_TIME: Record<SlotKey, string> = {
  wake: '07:00',
  breakfast: '07:30',
  lunch: '12:00',
  dinner: '17:45',
};
export const DEFAULT_NAP = { start: '13:00', end: '14:30' };
export const DEFAULT_SNACK_TIME = '15:00';

export const AMOUNT_TEXT: Record<string, string> = {
  All: 'ate it all',
  Most: 'ate most',
  Some: 'ate some',
  'A little': 'ate a little',
  None: "didn't eat",
};

export const KIND_COLORS: Record<string, string> = {
  Note: 'sage',
  Health: 'peach',
  Medicine: 'warn',
  Diaper: 'butter',
  Milestone: 'lav',
};
