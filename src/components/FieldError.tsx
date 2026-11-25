export type FormError = { message: string; field?: string } | null;

/** The message for one field, shown right under it. */
export function FieldError({ error, field }: { error: FormError; field: string }) {
  if (!error || error.field !== field) return null;
  return (
    <p className="err" role="alert">
      {error.message}
    </p>
  );
}

/** A message that isn't about one field. */
export function FormMessage({ error, fields }: { error: FormError; fields: string[] }) {
  if (!error || (error.field && fields.includes(error.field))) return null;
  return (
    <p className="err" role="alert">
      {error.message}
    </p>
  );
}
