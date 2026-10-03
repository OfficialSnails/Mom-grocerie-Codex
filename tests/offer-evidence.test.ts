import { describe, expect, it } from 'vitest';
import { evidenceFor, explicitPackage, historicalEvidence, observedHistory, historyCatalog } from '../src/offer-evidence.js';
const raw = { store_id: 'maxi-joliette', store_name: 'Maxi', item_name: 'FRAISES, 1 L', current_price: 2.99, unit: 'each', confidence: 'HIGH' as const };
describe('offer evidence', () => {
  it('exposes archived unknown formats without fabricating equivalence or mixing stores and units', () => {
    const base = { date_observed: '2026-05-01', store: 'metro-joliette', item_name: 'Céleri', price: '1.99', unit: '', size: '', source: 'flipp' };
    const data = historyCatalog([base, base, { ...base, date_observed: '2026-06-01', price: '2.99' },
      { ...base, store: 'maxi-joliette' }, { ...base, unit: 'lb' }, { ...base, source: 'csv' }, { ...base, price: 'invalid' }], { 'metro-joliette': 'Metro' });
    expect(data.series).toHaveLength(4);
    expect(data.observationCount).toBe(5);
    expect(data.series.filter(series => series.source === 'csv')).toHaveLength(1);
    expect(data.series[0]).toMatchObject({ storeName: 'Metro', format: null, points: [{ price: 1.99 }, { price: 2.99 }] });
  });
  it('rejects mixed/range formats and unknown sale units', () => {
    expect(explicitPackage('Beurre 454/850 g')).toBeNull();
    expect(explicitPackage('Carottes 3 lb ou citrons 2 lb')).toBeNull();
    expect(explicitPackage('Jus 8x200 ml')).toBe('8x200ml');
    expect(evidenceFor({ ...raw, unit: undefined }).format).toBeNull();
  });
  it('attaches a photo only to the exact archived store, date, price and format', () => {
    const row = { date_observed: '2026-10-01', store: raw.store_id, item_name: raw.item_name, price: '2.99', unit: 'each', size: '', source: 'flipp' };
    const offer = { ...raw, source_system: 'flipp' as const, sale_start: '2026-10-01T00:00:00-04:00', source_image_url: 'https://example.com/exact.jpg' };
    const variations = [row, { ...row, store: 'iga-joliette' }, { ...row, date_observed: '2026-09-24' },
      { ...row, price: '3.99' }, { ...row, unit: 'lb' }, { ...row, size: '2' }, { ...row, source: 'csv' }];
    const catalog = historyCatalog(variations, {}, [offer]);
    expect(catalog.observationCount).toBe(7);
    expect(catalog.series.flatMap(item => item.points).filter(point => point.proofImageUrl))
      .toEqual([{ date: '2026-10-01', price: 2.99, proofImageUrl: offer.source_image_url, proofCrop: undefined }]);
  });
  it('does not pick between ambiguous photos or attach mock proof', () => {
    const row = { date_observed: '2026-10-01', store: raw.store_id, item_name: raw.item_name, price: '2.99', unit: 'each', size: '', source: 'flipp' };
    const offer = { ...raw, source_system: 'flipp' as const, sale_start: '2026-10-01', source_image_url: 'https://example.com/a.jpg' };
    expect(historyCatalog([row], {}, [offer, offer]).series[0].points[0].proofImageUrl).toBe(offer.source_image_url);
    expect(historyCatalog([row], {}, [offer, { ...offer, source_image_url: 'https://example.com/b.jpg' }]).series[0].points[0].proofImageUrl).toBeUndefined();
    expect(historyCatalog([row], {}, [{ ...offer, source_system: 'mock' }]).series[0].points[0].proofImageUrl).toBeUndefined();
  });
  it('applies reviewed photo facts only to the exact fetched price', () => {
    const proof = { currentPrice: .99, format: 'gr24-each', unit: 'each', member: true, note: 'Source photo' };
    expect(evidenceFor({ ...raw, unit: undefined }, proof).format).toBeNull();
    expect(evidenceFor({ ...raw, current_price: .99 }, proof)).toMatchObject({ format: 'gr24-each', member: true });
  });
  it('uses separate prior weeks, exact product/store/format and excludes the current week', () => {
    const row = { store: raw.store_id, item_name: raw.item_name, price: '4.99', unit: 'each', size: '', source: 'flipp' };
    const rows = ['2026-09-03', '2026-09-10', '2026-09-17', '2026-09-17'].map(date_observed => ({ ...row, date_observed }));
    rows.push({ ...row, price: '99', date_observed: '2026-10-01' });
    const history = historicalEvidence(raw, evidenceFor(raw), rows, '2026-10-01');
    expect(history).toMatchObject({ median: 4.99, low: 4.99, weeks: 3 });
    expect(history?.points).toEqual([
      { date: '2026-09-03', price: 4.99 }, { date: '2026-09-10', price: 4.99 }, { date: '2026-09-17', price: 4.99 },
    ]);
    expect(historicalEvidence(raw, evidenceFor(raw), rows.map(r => ({ ...r, unit: 'kg' })), '2026-10-01')).toBeUndefined();
  });
  it('does not reinterpret historical unknown units using a current photo', () => {
    const current = { ...raw, unit: undefined };
    const facts = evidenceFor(current, { currentPrice: 2.99, unit: 'each', format: '1x1l', note: 'Photo' });
    expect(historicalEvidence(current, facts, [], '2026-10-01')).toBeUndefined();
  });
  it('allows a photo-confirmed regular price for an assorted package without inventing an exact format', () => {
    const assorted = { ...raw, item_name: 'Gruau Quaker', current_price: 1.99, unit: undefined };
    expect(evidenceFor(assorted, { currentPrice: 1.99, unit: 'pack', regularPrice: 3.99, note: 'Photo reviewed' }))
      .toMatchObject({ regularPrice: 3.99, format: null });
    expect(evidenceFor({ ...assorted, regular_price: 3.99 }).regularPrice).toBeNull();
  });
});


describe('unconfirmed historical observations', () => {
  it('keeps dated observations distinct from comparable benchmarks and excludes future, manual and other-store records', () => {
    const current = { ...raw, unit: undefined };
    const row = { store: raw.store_id, item_name: raw.item_name, price: '4.99', unit: '', size: '', source: 'flipp' };
    const rows = [
      { ...row, date_observed: '2026-09-03' }, { ...row, date_observed: '2026-09-10' },
      { ...row, date_observed: '2026-10-01' }, { ...row, date_observed: '2026-10-08' },
      { ...row, date_observed: '2026-09-17', source: 'csv' },
      { ...row, date_observed: '2026-09-17', store: 'iga-joliette' },
      { ...row, date_observed: '2026-09-17', unit: 'kg' },
    ];
    expect(observedHistory(current, rows, '2026-10-01')).toMatchObject({ weeks: 2, from: '2026-09-03', to: '2026-09-10' });
    expect(historicalEvidence(current, evidenceFor(current), rows, '2026-10-01')).toBeUndefined();
  });
});
