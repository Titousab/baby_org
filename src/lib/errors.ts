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
