import type { ShiftView } from '@/lib/schedule/coverage';

export type DayData = {
  date: string;
  dow: string; // 'Mon'
  monthDay: string; // 'Nov 30'
  dayNum: number;
  isToday: boolean;
  weekend: boolean;
  dayOff: string | null;
  need: boolean;
  shifts: ShiftView[];
  gaps: Array<[number, number]>;
};

export type Person = { id: number; name: string; color: string };
