import { describe, expect, test } from 'vitest';
import { logSlots } from '@/db/schema';
import { clearSlot, deleteNote, getDayLog, recentFoods, saveNote, saveSlot } from '@/lib/log';
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
      endTime: null,
      food: 'Oatmeal with blueberries',
      amount: 'Most',
      byName: 'Mom',
    });
    expect(day.slots.snack).toBeNull();
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

  test('a nap has to end after it starts', async () => {
    const { db, mom } = await setup();
    await expect(
      saveSlot(db, { date: TODAY, slot: 'nap', time: '13:00', endTime: '12:30' }, mom, TODAY),
    ).rejects.toMatchObject({ name: 'ValidationError', field: 'endTime', message: 'The nap has to end after it starts.' });
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
  test('splits recent meals into foods, newest first, padded with defaults', async () => {
    const { db, mom } = await setup();
    await saveSlot(db, { date: '2026-11-24', slot: 'lunch', time: '12:00', food: 'Pasta with peas and cheese', amount: 'All' }, mom, TODAY);
    await saveSlot(db, { date: TODAY, slot: 'snack', time: '15:00', food: 'Yogurt and banana', amount: 'All' }, mom, TODAY);

    const foods = await recentFoods(db);
    expect(foods).toHaveLength(10);
    expect(foods.slice(0, 5)).toEqual(['Yogurt', 'Banana', 'Pasta', 'Peas', 'Cheese']);
    expect(new Set(foods.map((f) => f.toLowerCase())).size).toBe(10);
    expect(foods).toContain('Oatmeal');
  });

  test('with no meals yet, the defaults are offered', async () => {
    const { db } = await setup();
    expect(await recentFoods(db)).toEqual(['Banana', 'Yogurt', 'Oatmeal', 'Toast', 'Avocado', 'Berries', 'Cheese', 'Pasta', 'Chicken', 'Rice']);
  });
});
