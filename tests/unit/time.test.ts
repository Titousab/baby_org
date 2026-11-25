import { describe, expect, test } from 'vitest';
import {
  addDays,
  dayNum,
  dayOfWeek,
  dowLong,
  dowShort,
  monthDay,
  fmtDayLong,
  fmtDayShort,
  fmtDuration,
  fmtHours,
  fmtRange,
  fmtTime,
  fmtWeekRange,
  fromMin,
  minutesNowNY,
  toMin,
  todayNY,
  weekStartOf,
} from '@/lib/time';

describe('New York clock', () => {
  test('late evening in New York while UTC is already tomorrow', () => {
    const lateEvening = new Date('2026-11-26T04:30:00Z'); // 11:30 pm EST on Nov 25
    expect(todayNY(lateEvening)).toBe('2026-11-25');
    expect(minutesNowNY(lateEvening)).toBe(23 * 60 + 30);
  });

  test('summer time offset is respected', () => {
    expect(todayNY(new Date('2026-07-04T03:59:00Z'))).toBe('2026-07-03'); // 11:59 pm EDT
    expect(minutesNowNY(new Date('2026-07-04T13:05:00Z'))).toBe(9 * 60 + 5);
  });
});

describe('date math', () => {
  test('addDays across the DST changes', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(addDays('2027-03-14', -1)).toBe('2027-03-13');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  test('weekStartOf returns the Monday', () => {
    expect(weekStartOf('2026-11-01')).toBe('2026-10-26');
    expect(weekStartOf('2027-03-14')).toBe('2027-03-08');
    expect(weekStartOf('2026-11-25')).toBe('2026-11-23');
    expect(weekStartOf('2026-11-23')).toBe('2026-11-23');
  });

  test('dayOfWeek uses 0 for Sunday', () => {
    expect(dayOfWeek('2026-11-25')).toBe(3);
    expect(dayOfWeek('2026-11-29')).toBe(0);
  });

  test('minutes round-trip', () => {
    expect(toMin('18:30')).toBe(1110);
    expect(fromMin(1110)).toBe('18:30');
    expect(fromMin(480)).toBe('08:00');
  });
});

describe('display formats match the mockup', () => {
  test('times and ranges', () => {
    expect(fmtTime('06:45')).toBe('6:45 am');
    expect(fmtTime(12 * 60)).toBe('12:00 pm');
    expect(fmtTime('00:15')).toBe('12:15 am');
    expect(fmtRange('09:50', '11:10')).toBe('9:50 – 11:10 am');
    expect(fmtRange('08:00', '16:00')).toBe('8:00 am – 4:00 pm');
    expect(fmtRange(960, 1110)).toBe('4:00 – 6:30 pm');
  });

  test('durations and hours', () => {
    expect(fmtDuration(80)).toBe('1h 20m');
    expect(fmtDuration(45)).toBe('45m');
    expect(fmtDuration(120)).toBe('2h');
    expect(fmtHours(150)).toBe('2.5h');
    expect(fmtHours(480)).toBe('8h');
  });

  test('short weekday, month-day and day number helpers', () => {
    expect(dowShort('2026-11-25')).toBe('Wed');
    expect(dowLong('2026-11-25')).toBe('Wednesday');
    expect(monthDay('2026-11-25')).toBe('Nov 25');
    expect(dayNum('2026-12-06')).toBe(6);
  });

  test('week ranges and day names', () => {
    expect(fmtWeekRange('2026-11-23')).toBe('Nov 23 – 29');
    expect(fmtWeekRange('2026-11-30')).toBe('Nov 30 – Dec 6');
    expect(fmtDayLong('2026-11-25')).toBe('Wednesday, November 25');
    expect(fmtDayShort('2026-11-25')).toBe('Wed, Nov 25');
  });
});
