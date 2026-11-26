import { describe, expect, test } from 'vitest';
import { logSlots } from '@/db/schema';
import {
  clearSlot,
  deleteNap,
  deleteNote,
  deleteSnack,
  endNapNow,
  getDayLog,
  recentFoods,
  saveNap,
  saveNote,
  saveSlot,
  saveSnack,
  startNapNow,
} from '@/lib/log';
import { napMinutes, runningNap } from '@/lib/log-types';
import { createTestDb, seedUser } from '../helpers/test-db';

const TODAY = '2026-11-25';

async function setup() {
  const db = await createTestDb();
  const mom = await seedUser(db, { name: 'Mom' });
  const selina = await seedUser(db, { name: 'Selina', role: 'caretaker' });
  return { db, mom, selina };
}

describe('slots', () => {
  test('a saved breakfast shows who saved it; untouched slots are empty', async () => {
    const { db, mom } = await setup();
    await saveSlot(db, { date: TODAY, slot: 'breakfast', time: '07:30', food: 'Oatmeal with blueberries', amount: 'Most' }, mom, TODAY);
    const day = await getDayLog(db, TODAY);
    expect(day.slots.breakfast).toEqual({
      slot: 'breakfast',
      time: '07:30',
      food: 'Oatmeal with blueberries',
      amount: 'Most',
      byName: 'Mom',
    });
    expect(day.slots.lunch).toBeNull();
    expect(day.snacks).toEqual([]);
  });

  test('when two people save the same slot, the last save wins and shows its author', async () => {
    const { db, mom, selina } = await setup();
    await saveSlot(db, { date: TODAY, slot: 'lunch', time: '12:00', food: 'Pasta', amount: 'All' }, mom, TODAY);
    await saveSlot(db, { date: TODAY, slot: 'lunch', time: '12:15', food: 'Pasta with peas', amount: 'Some' }, selina, TODAY);
    const day = await getDayLog(db, TODAY);
    expect(day.slots.lunch).toMatchObject({ food: 'Pasta with peas', time: '12:15', byName: 'Selina' });
    expect(await db.select().from(logSlots)).toHaveLength(1);
  });

  test('a meal needs what he ate', async () => {
    const { db, mom } = await setup();
    await expect(
      saveSlot(db, { date: TODAY, slot: 'dinner', time: '17:45', food: '   ', amount: 'All' }, mom, TODAY),
    ).rejects.toMatchObject({ name: 'ValidationError', field: 'food', message: 'Write what he ate, like "banana and yogurt".' });
  });

  test('naps are no longer a single slot', async () => {
    const { db, mom } = await setup();
    // @ts-expect-error 'nap' is not a slot any more
    await expect(saveSlot(db, { date: TODAY, slot: 'nap', time: '13:00' }, mom, TODAY)).rejects.toMatchObject({ name: 'ValidationError' });
  });

  test('snacks are no longer a single slot', async () => {
    const { db, mom } = await setup();
    // @ts-expect-error 'snack' is not a slot any more
    await expect(saveSlot(db, { date: TODAY, slot: 'snack', time: '15:00', food: 'Crackers' }, mom, TODAY)).rejects.toMatchObject({ name: 'ValidationError' });
  });

  test('a day that has not happened yet cannot be logged; today can', async () => {
    const { db, mom } = await setup();
    await expect(saveSlot(db, { date: '2026-11-26', slot: 'wake', time: '06:45' }, mom, TODAY)).rejects.toMatchObject({
      name: 'ValidationError',
      message: "You can't log a day that hasn't happened yet.",
    });
    await saveSlot(db, { date: TODAY, slot: 'wake', time: '06:45' }, mom, TODAY);
    expect((await getDayLog(db, TODAY)).slots.wake?.time).toBe('06:45');
  });

  test('unknown slots, amounts and malformed times are rejected', async () => {
    const { db, mom } = await setup();
    // @ts-expect-error testing a bad slot from a form
    await expect(saveSlot(db, { date: TODAY, slot: 'brunch', time: '10:00' }, mom, TODAY)).rejects.toMatchObject({ name: 'ValidationError' });
    await expect(
      saveSlot(db, { date: TODAY, slot: 'lunch', time: '12:00', food: 'Rice', amount: 'Lots' }, mom, TODAY),
    ).rejects.toMatchObject({ name: 'ValidationError' });
    await expect(saveSlot(db, { date: TODAY, slot: 'wake', time: '7am' }, mom, TODAY)).rejects.toMatchObject({ name: 'ValidationError', field: 'time' });
  });

  test('clearing a slot empties it', async () => {
    const { db, mom } = await setup();
    await saveSlot(db, { date: TODAY, slot: 'wake', time: '06:45' }, mom, TODAY);
    await clearSlot(db, TODAY, 'wake');
    expect((await getDayLog(db, TODAY)).slots.wake).toBeNull();
  });
});

describe('naps', () => {
  test('a day can have several naps, sorted, each showing who saved it, with a total', async () => {
    const { db, mom, selina } = await setup();
    await saveNap(db, { date: TODAY, start: '15:30', end: '16:00' }, selina, TODAY);
    await saveNap(db, { date: TODAY, start: '09:50', end: '11:10' }, mom, TODAY);
    const day = await getDayLog(db, TODAY);
    expect(day.naps.map((n) => `${n.start}-${n.end} ${n.byName}`)).toEqual(['09:50-11:10 Mom', '15:30-16:00 Selina']);
    expect(napMinutes(day.naps)).toBe(110);
  });

  test('a nap has to end after it starts', async () => {
    const { db, mom } = await setup();
    await expect(saveNap(db, { date: TODAY, start: '13:00', end: '12:30' }, mom, TODAY)).rejects.toMatchObject({
      name: 'ValidationError',
      field: 'end',
      message: 'The nap has to end after it starts.',
    });
    await expect(saveNap(db, { date: '2026-11-26', start: '13:00', end: '14:00' }, mom, TODAY)).rejects.toMatchObject({
      message: "You can't log a day that hasn't happened yet.",
    });
  });

  test('a nap can be edited and deleted', async () => {
    const { db, mom, selina } = await setup();
    await saveNap(db, { date: TODAY, start: '13:00', end: '14:00' }, mom, TODAY);
    const [nap] = (await getDayLog(db, TODAY)).naps;
    await saveNap(db, { id: nap.id, date: TODAY, start: '13:10', end: '14:40' }, selina, TODAY);
    expect((await getDayLog(db, TODAY)).naps).toMatchObject([{ id: nap.id, start: '13:10', end: '14:40', byName: 'Selina' }]);
    await deleteNap(db, nap.id);
    expect((await getDayLog(db, TODAY)).naps).toEqual([]);
  });

  test('a nap can be saved before he wakes up; it stays out of the total until someone adds the end', async () => {
    const { db, mom, selina } = await setup();
    await saveNap(db, { date: TODAY, start: '09:50', end: '11:10' }, mom, TODAY);
    await saveNap(db, { date: TODAY, start: '13:05', end: '' }, selina, TODAY);
    let day = await getDayLog(db, TODAY);
    expect(day.naps.map((n) => `${n.start}-${n.end} ${n.byName}`)).toEqual(['09:50-11:10 Mom', '13:05-null Selina']);
    expect(napMinutes(day.naps)).toBe(80);
    const running = runningNap(day.naps)!;
    expect(running.start).toBe('13:05');

    await saveNap(db, { id: running.id, date: TODAY, start: '13:05', end: '14:20' }, mom, TODAY);
    day = await getDayLog(db, TODAY);
    expect(runningNap(day.naps)).toBeUndefined();
    expect(napMinutes(day.naps)).toBe(155);
    expect(day.naps[1].byName).toBe('Mom');
  });

  test('only one nap a day can be running', async () => {
    const { db, mom, selina } = await setup();
    await saveNap(db, { date: TODAY, start: '13:05' }, mom, TODAY);
    await expect(saveNap(db, { date: TODAY, start: '13:20' }, selina, TODAY)).rejects.toMatchObject({
      name: 'ValidationError',
      message: "He's already asleep since 1:05 pm. Add when he woke up first.",
    });
    const [running] = (await getDayLog(db, TODAY)).naps;
    await saveNap(db, { id: running.id, date: TODAY, start: '13:00' }, selina, TODAY);
    await saveNap(db, { date: TODAY, start: '09:00', end: '09:40' }, selina, TODAY);
    await saveNap(db, { date: '2026-11-24', start: '13:00' }, selina, TODAY);
    expect((await getDayLog(db, TODAY)).naps.map((n) => `${n.start}-${n.end}`)).toEqual(['09:00-09:40', '13:00-null']);
  });

  test('two people tapping "asleep now" at once still get one running nap', async () => {
    const { db, mom, selina } = await setup();
    const at = new Date('2026-11-25T18:05:00Z');
    const results = await Promise.allSettled([startNapNow(db, mom, at), startNapNow(db, selina, at)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await getDayLog(db, TODAY)).naps).toHaveLength(1);
  });

  test('"asleep now" and "woke up now" use the time in New York', async () => {
    const { db, mom, selina } = await setup();
    await startNapNow(db, selina, new Date('2026-11-25T18:05:00Z'));
    const [nap] = (await getDayLog(db, TODAY)).naps;
    expect(nap).toMatchObject({ start: '13:05', end: null, byName: 'Selina' });
    await endNapNow(db, nap.id, mom, new Date('2026-11-25T19:47:30Z'));
    expect((await getDayLog(db, TODAY)).naps).toMatchObject([{ start: '13:05', end: '14:47', byName: 'Mom' }]);
  });

  test('"woke up now" is refused in the same minute, on a later day, after someone ended it, or once removed', async () => {
    const { db, mom, selina } = await setup();
    await startNapNow(db, mom, new Date('2026-11-25T18:05:00Z'));
    const [nap] = (await getDayLog(db, TODAY)).naps;
    await expect(endNapNow(db, nap.id, mom, new Date('2026-11-25T18:05:40Z'))).rejects.toMatchObject({
      field: 'end',
      message: 'The nap has to end after it starts.',
    });
    await expect(endNapNow(db, nap.id, mom, new Date('2026-11-26T15:00:00Z'))).rejects.toMatchObject({
      field: 'end',
      message: 'Type when he woke up.',
    });
    await endNapNow(db, nap.id, mom, new Date('2026-11-25T19:00:00Z'));
    await expect(endNapNow(db, nap.id, selina, new Date('2026-11-25T19:10:00Z'))).rejects.toMatchObject({
      message: 'Someone already added when he woke up.',
    });
    expect((await getDayLog(db, TODAY)).naps[0].end).toBe('14:00');
    await deleteNap(db, nap.id);
    await expect(endNapNow(db, nap.id, mom, new Date('2026-11-25T19:10:00Z'))).rejects.toMatchObject({ message: 'That nap was removed.' });
  });
});

describe('snacks', () => {
  test('a day can have several snacks, sorted by time then save order, each showing who saved it', async () => {
    const { db, mom, selina } = await setup();
    await saveSnack(db, { date: TODAY, time: '15:00', food: 'Crackers', amount: 'Some' }, selina, TODAY);
    await saveSnack(db, { date: TODAY, time: '10:00', food: 'Apple slices', amount: 'All' }, mom, TODAY);
    await saveSnack(db, { date: TODAY, time: '15:00', food: '  Cheese ' }, mom, TODAY);
    const day = await getDayLog(db, TODAY);
    expect(day.snacks.map((s) => `${s.time} ${s.food} ${s.amount} ${s.byName}`)).toEqual([
      '10:00 Apple slices All Mom',
      '15:00 Crackers Some Selina',
      '15:00 Cheese null Mom',
    ]);
  });

  test('a snack needs what he ate, a known amount, a real time and a day that has happened', async () => {
    const { db, mom } = await setup();
    await expect(saveSnack(db, { date: TODAY, time: '15:00', food: ' ' }, mom, TODAY)).rejects.toMatchObject({
      field: 'food',
      message: 'Write what he ate, like "banana and yogurt".',
    });
    await expect(saveSnack(db, { date: TODAY, time: '15:00', food: 'Rice', amount: 'Lots' }, mom, TODAY)).rejects.toMatchObject({ name: 'ValidationError' });
    await expect(saveSnack(db, { date: TODAY, time: '3pm', food: 'Rice' }, mom, TODAY)).rejects.toMatchObject({ field: 'time' });
    await expect(saveSnack(db, { date: '2026-11-26', time: '15:00', food: 'Rice' }, mom, TODAY)).rejects.toMatchObject({
      message: "You can't log a day that hasn't happened yet.",
    });
    expect((await getDayLog(db, TODAY)).snacks).toEqual([]);
  });

  test('editing one snack changes only that one; a snack can be deleted', async () => {
    const { db, mom, selina } = await setup();
    await saveSnack(db, { date: TODAY, time: '10:00', food: 'Apple slices', amount: 'All' }, mom, TODAY);
    await saveSnack(db, { date: TODAY, time: '15:00', food: 'Crackers', amount: 'Some' }, mom, TODAY);
    const [morning, afternoon] = (await getDayLog(db, TODAY)).snacks;
    await saveSnack(db, { id: morning.id, date: TODAY, time: '10:30', food: 'Pear slices', amount: 'Most' }, selina, TODAY);
    expect((await getDayLog(db, TODAY)).snacks).toEqual([
      { id: morning.id, time: '10:30', food: 'Pear slices', amount: 'Most', byName: 'Selina' },
      afternoon,
    ]);
    await deleteSnack(db, morning.id);
    expect((await getDayLog(db, TODAY)).snacks).toEqual([afternoon]);
  });
});

describe('notes', () => {
  test('notes need text, come back sorted by time, and can be edited and deleted', async () => {
    const { db, mom, selina } = await setup();
    await expect(saveNote(db, { date: TODAY, time: '09:00', kind: 'Note', text: ' ' }, mom, TODAY)).rejects.toMatchObject({
      field: 'text',
      message: 'Add a few words so the others know what happened.',
    });
    await expect(saveNote(db, { date: TODAY, time: '09:00', kind: 'Gossip', text: 'Hi' }, mom, TODAY)).rejects.toMatchObject({
      name: 'ValidationError',
    });

    await saveNote(db, { date: TODAY, time: '11:40', kind: 'Milestone', text: 'Said "truck"!' }, selina, TODAY);
    await saveNote(db, { date: TODAY, time: '08:10', kind: 'Health', text: 'Runny nose, no fever.' }, mom, TODAY);
    let notes = (await getDayLog(db, TODAY)).notes;
    expect(notes.map((n) => n.time)).toEqual(['08:10', '11:40']);
    expect(notes[1]).toMatchObject({ kind: 'Milestone', text: 'Said "truck"!', byName: 'Selina' });

    await saveNote(db, { id: notes[0].id, date: TODAY, time: '08:15', kind: 'Health', text: 'Runny nose, still no fever.' }, selina, TODAY);
    notes = (await getDayLog(db, TODAY)).notes;
    expect(notes[0]).toMatchObject({ time: '08:15', text: 'Runny nose, still no fever.', byName: 'Selina' });

    await deleteNote(db, notes[0].id);
    expect((await getDayLog(db, TODAY)).notes).toHaveLength(1);
  });
});

describe('recentFoods', () => {
  test('splits recent meals and snacks into foods, newest first, padded with defaults', async () => {
    const { db, mom } = await setup();
    await saveSnack(db, { date: '2026-11-23', time: '15:00', food: 'Apple slices', amount: 'All' }, mom, TODAY);
    await saveSlot(db, { date: '2026-11-24', slot: 'lunch', time: '12:00', food: 'Pasta with peas and cheese', amount: 'All' }, mom, TODAY);
    await saveSnack(db, { date: TODAY, time: '15:00', food: 'Yogurt and banana', amount: 'All' }, mom, TODAY);

    const foods = await recentFoods(db);
    expect(foods).toHaveLength(10);
    expect(foods.slice(0, 6)).toEqual(['Yogurt', 'Banana', 'Pasta', 'Peas', 'Cheese', 'Apple slices']);
    expect(new Set(foods.map((f) => f.toLowerCase())).size).toBe(10);
  });

  test('with no meals yet, the defaults are offered', async () => {
    const { db } = await setup();
    expect(await recentFoods(db)).toEqual(['Banana', 'Yogurt', 'Oatmeal', 'Toast', 'Avocado', 'Berries', 'Cheese', 'Pasta', 'Chicken', 'Rice']);
  });
});
