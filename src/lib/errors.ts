/** A problem with what someone typed. `message` is shown to them as written. */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** The signed-in person isn't allowed to do this. */
export class ForbiddenError extends Error {
  constructor(message = 'Only family members can change this.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export type ActionResult = { ok: true } | { ok: false; message: string; field?: string };

/** Runs a change and reports what the person needs to know. Unexpected errors (and redirects) pass through. */
export async function guard(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    if (e instanceof ValidationError) return e.field ? { ok: false, message: e.message, field: e.field } : { ok: false, message: e.message };
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}
