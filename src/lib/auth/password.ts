import bcrypt from 'bcryptjs';

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Emails are compared trimmed and lowercased everywhere. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
