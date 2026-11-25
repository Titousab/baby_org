import { expect, test } from 'vitest';
import { callAction, COULD_NOT_SAVE } from '@/lib/call-action';

test('a save that fails unexpectedly becomes a message instead of an error page', async () => {
  const result = await callAction(async () => {
    throw new TypeError('Failed to fetch');
  });
  expect(result).toEqual({ ok: false, message: COULD_NOT_SAVE });
  expect(COULD_NOT_SAVE).toBe("Couldn't save. Check your connection and try again.");
});

test('normal results pass straight through', async () => {
  expect(await callAction(async () => ({ ok: true }))).toEqual({ ok: true });
  expect(await callAction(async () => ({ ok: false, message: 'Pick a time.', field: 'time' }))).toEqual({
    ok: false,
    message: 'Pick a time.',
    field: 'time',
  });
});

test("Next.js redirects (e.g. a signed-out session) are not swallowed", async () => {
  const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/signin;307;' });
  await expect(callAction(async () => { throw redirect; })).rejects.toBe(redirect);
});
