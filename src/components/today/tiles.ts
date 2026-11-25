import type { IconName } from '@/components/Icon';
import type { SlotKey } from '@/lib/log';

export type TileDef = { key: SlotKey; label: string; kind: 'time' | 'meal' | 'nap'; color: string; icon: IconName };

/** The six daily tiles, in mockup order. */
export const TILES: TileDef[] = [
  { key: 'wake', label: 'Woke up', kind: 'time', color: 'butter', icon: 'sun' },
  { key: 'breakfast', label: 'Breakfast', kind: 'meal', color: 'peach', icon: 'bowl' },
  { key: 'nap', label: 'Nap', kind: 'nap', color: 'sky', icon: 'moon' },
  { key: 'lunch', label: 'Lunch', kind: 'meal', color: 'peach', icon: 'bowl' },
  { key: 'snack', label: 'Snack', kind: 'meal', color: 'sage', icon: 'apple' },
  { key: 'dinner', label: 'Dinner', kind: 'meal', color: 'peach', icon: 'bowl' },
];

export const DEFAULT_TIME: Record<SlotKey, string> = {
  wake: '07:00',
  breakfast: '07:30',
  nap: '13:00',
  lunch: '12:00',
  snack: '15:00',
  dinner: '17:45',
};
export const DEFAULT_NAP_END = '14:30';

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
