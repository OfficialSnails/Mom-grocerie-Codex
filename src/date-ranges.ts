export interface DateRange {
  start: Date;
  end: Date;
}

export function parseDateOnly(value?: string | null, endOfDay = false): Date | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return parsed;
}

export function formatLocalDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

export function flyerWeekRangeForSourceRun(runDate: Date = new Date()): DateRange {
  const start = new Date(runDate);
  const runDay = start.getDay();
  start.setHours(0, 0, 0, 0);
  const daysSinceThursday = (start.getDay() - 4 + 7) % 7;
  start.setDate(start.getDate() - daysSinceThursday);

  // Wednesday preview runs should collect the flyer cycle that starts tomorrow.
  if (runDay === 3) {
    start.setDate(start.getDate() + 7);
  }

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function datedRowOverlapsRange(
  startValue?: string | null,
  endValue?: string | null,
  targetRange: DateRange = flyerWeekRangeForSourceRun(),
): boolean {
  const rowStart = parseDateOnly(startValue ?? endValue ?? null);
  const rowEnd = parseDateOnly(endValue ?? startValue ?? null, true);
  if (!rowStart || !rowEnd) return false;
  return rangesOverlap({ start: rowStart, end: rowEnd }, targetRange);
}
