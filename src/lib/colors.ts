/** The person colors, in the order new people receive them. */
export const PERSON_COLORS = ['butter', 'peach', 'lav', 'sky', 'sage'] as const;
export type PersonColor = (typeof PERSON_COLORS)[number];
