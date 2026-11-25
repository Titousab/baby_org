import { expect, test } from 'vitest';
import { ForbiddenError, guard, ValidationError } from '@/lib/errors';

test('guard turns expected errors into messages and lets others through', async () => {
  expect(await guard(async () => {})).toEqual({ ok: true });
  expect(await guard(async () => { throw new ValidationError('Pick a time.', 'time'); })).toEqual({
    ok: false,
    message: 'Pick a time.',
    field: 'time',
  });
  expect(await guard(async () => { throw new ForbiddenError(); })).toEqual({
    ok: false,
    message: 'Only family members can change this.',
  });
  await expect(guard(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
});
