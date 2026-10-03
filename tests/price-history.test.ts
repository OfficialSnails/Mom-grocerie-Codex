import { describe, expect, it } from 'vitest';
// @ts-expect-error Shared static browser module.
import { filterHistory, historyTitle, historyFormat, historyStats, flyerHistoryCatalog } from '../website/price-history-data.js';
const series = (id: string, points = [{ date: '2025-11-07', price: 2.99 }, { date: '2026-10-01', price: 1.99 }], extra = {}) => ({
  id, name: 'CÉLERI', storeId: 'metro', storeName: 'Metro', unit: '', format: null, source: 'flipp', points, ...extra,
});
describe('complete historical archive browsing', () => {
  it('excludes old imports from the public archive and recalculates its coverage without deleting stored records', () => {
    const data = { series: [series('flyer', [{ date: '2026-09-24', price: 3 }, { date: '2026-10-01', price: 4 }]), series('import', undefined, { source: 'csv' })], observationCount: 4, from: '2025-11-07', to: '2026-10-01' };
    expect(flyerHistoryCatalog(data)).toMatchObject({ observationCount: 2, from: '2026-09-24', to: '2026-10-01' });
    expect(flyerHistoryCatalog(data).series.map((item: { id: string }) => item.id)).toEqual(['flyer']);
    expect(data.series).toHaveLength(2);
    expect(flyerHistoryCatalog({ ...data, series: [data.series[1]] })).toMatchObject({ series: [], observationCount: 0, from: null, to: null });
  });
  it('does not truncate to recent weeks or the first hundred references', () => {
    const result = filterHistory(Array.from({ length: 205 }, (_, index) => series(String(index))), { endDate: '2026-10-01' });
    expect(result).toHaveLength(205);
    expect(result[204].points[0].date).toBe('2025-11-07');
  });
  it('filters names without case, accent or punctuation differences', () => {
    expect(filterHistory([series('one')], { query: ' céleri ', endDate: '2026-10-01' })).toHaveLength(1);
    expect(filterHistory([series('one')], { query: 'CELERI', endDate: '2026-10-01' })).toHaveLength(1);
    expect(filterHistory([series('one')], { query: 'celeri bio', endDate: '2026-10-01' })).toHaveLength(0);
  });
  it('keeps imported records distinct and applies the period before the price-change filter', () => {
    const data = [series('a'), series('b', undefined, { source: 'csv' }), series('c', undefined, { storeId: 'maxi' })];
    expect(filterHistory(data, { source: 'csv', endDate: '2026-10-01' }).map((s: { id: string }) => s.id)).toEqual(['b']);
    expect(filterHistory(data, { store: 'metro', changed: true, endDate: '2026-10-01' })).toHaveLength(2);
    expect(filterHistory(data, { months: '3', changed: true, endDate: '2026-10-01' })).toHaveLength(0);
  });
  it('does not fabricate a change for a flat series or a missing week', () => {
    const points = [{ date: '2026-08-13', price: 3.5 }, { date: '2026-10-01', price: 3.5 }];
    expect(historyStats(points)).toMatchObject({ changed: false, dates: 2, low: 3.5, high: 3.5, median: 3.5 });
    expect(filterHistory([series('a', points)], { endDate: '2026-10-01' })[0].points).toEqual(points);
  });
  it('preserves multiple observed prices on the same date instead of inventing one latest price', () => {
    expect(historyStats([{ date: '2026-10-01', price: 3 }, { date: '2026-10-01', price: 4 }]))
      .toMatchObject({ latest: [3, 4], median: 3.5, dates: 1, changed: true });
  });
  it('uses consistent product casing and readable formats without inventing unknown sizes', () => {
    expect(historyTitle('MARGARINE PC MENU BLEU, 907 G')).toBe('Margarine PC menu bleu, 907 g');
    expect(historyTitle('Dumplings À LA Vapeur')).toBe('Dumplings à la vapeur');
    expect(historyFormat({ format: '1x2.5kg' })).toBe('2,5 kg');
    expect(historyFormat({ format: null, unit: '' })).toBe('Format non renseigné');
  });
});
