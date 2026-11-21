/** Validate before pg can silently fall back to a local database. Never echo secrets. */
export function validateDatabaseUrl(value: string | undefined): string {
  const message = 'DATABASE_URL must be the complete PostgreSQL connection URI from Tiger Data, including its hostname and database. Copy the URI (not a psql command) into .env and surround it with double quotes.';
  if (!value || value.includes('YOUR_')) throw new Error(message);
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
      throw new Error('Invalid database URI');
    }
    return value;
  } catch {
    throw new Error(message);
  }
}
