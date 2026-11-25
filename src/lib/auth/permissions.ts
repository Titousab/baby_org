import { ForbiddenError } from '@/lib/errors';
import type { SessionUser } from './session';

export function isFamily(user: SessionUser): boolean {
  return user.role === 'family';
}

/** Shifts, days off, people and settings are family-only. Throws for caretakers. */
export function assertFamily(user: SessionUser): void {
  if (!isFamily(user)) throw new ForbiddenError('Only family members can change this.');
}
