export function getLocalDateParts(
  now: Date,
  timezone: string,
): { year: number; month: number; day: number; dow: number } {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const year = parseInt(parts.year, 10);
  const month = parseInt(parts.month, 10) - 1; // 0-indexed
  const day = parseInt(parts.day, 10);
  const dow = new Date(Date.UTC(year, month, day)).getUTCDay(); // 0=Sun
  return { year, month, day, dow };
}

export function formatUTCDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
