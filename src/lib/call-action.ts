import type { ActionResult } from './errors';

export const COULD_NOT_SAVE = "Couldn't save. Check your connection and try again.";

/** Next.js signals redirects and not-found pages by throwing; those must keep going. */
function isNextSignal(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && digest.startsWith('NEXT_');
}

/**
 * Calls a server action from a sheet. If the network or server fails, the person sees a message
 * and keeps what they typed, instead of the screen being replaced by an error page.
 */
export async function callAction(run: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await run();
  } catch (err) {
    if (isNextSignal(err)) throw err;
    console.error(err);
    return { ok: false, message: COULD_NOT_SAVE };
  }
}
