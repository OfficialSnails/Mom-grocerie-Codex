import { describe, expect, it, vi, afterEach } from 'vitest';
import { CsvAdapter, isCsvRowActiveForTargetWeek } from '../sources/csv-adapter.js';

describe('CsvAdapter date gating', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps manual rows only when they overlap the target flyer week', () => {
    const mayRow = { week_start_date: '2026-05-12', week_end_date: '2026-05-18' };

    expect(isCsvRowActiveForTargetWeek(mayRow, new Date('2026-05-14T12:00:00-04:00'))).toBe(true);
    expect(isCsvRowActiveForTargetWeek(mayRow, new Date('2026-06-11T12:00:00-04:00'))).toBe(false);
  });

  it('treats Wednesday runs as the upcoming Thursday flyer cycle', () => {
    const upcomingRow = { week_start_date: '2026-05-14', week_end_date: '2026-05-20' };
    expect(isCsvRowActiveForTargetWeek(upcomingRow, new Date('2026-05-13T12:00:00-04:00'))).toBe(true);
  });

  it('does not collect expired manual CSV rows for the current generated week', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T12:00:00-04:00'));

    const items = await new CsvAdapter().collect();

    expect(items.some(item => item.item_name.toLowerCase().includes('poitrine de poulet sans os'))).toBe(false);
  });
});

