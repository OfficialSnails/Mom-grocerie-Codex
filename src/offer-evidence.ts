import type { RawDealItem } from '../sources/source-adapter.js';

export interface ProofFact {
  currentPrice: number;
  verifiedPrice?: number;
  unit?: string;
  format?: string;
  formatLabel?: string;
  quantity?: number;
  regularPrice?: number;
  member?: boolean;
  note: string;
  proofCrop?: RawDealItem['source_proof_crop'];
}
export interface OfferEvidence {
  identity: string;
  fetchedPrice: number;
  verifiedPrice?: number;
  format: string | null;
  formatLabel: string | null;
  unit: string | null;
  member: boolean;
  regularPrice: number | null;
  advertisedPercent: number | null;
  source: string | null;
  proofCrop?: RawDealItem['source_proof_crop'];
  quantity?: number;
  observations?: { from: string; to: string; weeks: number; points: { date: string; price: number }[] };
  history?: { median: number; low: number; weeks: number; from: string; to: string; points: { date: string; price: number }[] };
}
export interface HistoryRow {
  date_observed: string; store: string; item_name: string; price: string;
  unit: string; size: string; source: string;
}

// Browsable observations are broader than a verified savings benchmark. Keep
// unknown formats visible without treating them as equivalent packages.
export function historyCatalog(rows: HistoryRow[], names: Record<string, string>, rawOffers: RawDealItem[] = []) {
  type Photo = { proofImageUrl: string; proofCrop?: RawDealItem['source_proof_crop'] };
  const photos = new Map<string, Map<string, Photo>>();
  const photoKey = (store: string, name: string, date: string, price: number, unit: string, size: string) =>
    JSON.stringify([store, identity(name), date, price, unit, size]);
  for (const offer of rawOffers) {
    if (offer.source_system !== 'flipp' || !offer.sale_start || !/^https:\/\//.test(offer.source_image_url ?? '')) continue;
    const key = photoKey(offer.store_id, offer.item_name, offer.sale_start.slice(0, 10), offer.current_price, offer.unit || '', offer.size || '');
    if (!photos.has(key)) photos.set(key, new Map());
    const variants = photos.get(key)!;
    const photo = { proofImageUrl: offer.source_image_url!, proofCrop: offer.source_proof_crop };
    if (!variants.has(photo.proofImageUrl) || photo.proofCrop) variants.set(photo.proofImageUrl, photo);
  }
  const groups = new Map<string, { id: string; name: string; storeId: string; storeName: string;
    unit: string; format: string | null; source: string; points: ({ date: string; price: number } & Partial<Photo>)[] }>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (!['flipp', 'csv'].includes(row.source) || !/^\d{4}-\d{2}-\d{2}$/.test(row.date_observed) || !Number.isFinite(Date.parse(row.date_observed))) continue;
    const price = Number(row.price);
    if (!Number.isFinite(price) || price <= 0 || !row.store || !row.item_name) continue;
    const id = JSON.stringify([row.store, identity(row.item_name), row.unit || '', row.size || '', row.source]);
    const observation = `${id}|${row.date_observed}|${price}`;
    if (seen.has(observation)) continue;
    seen.add(observation);
    if (!groups.has(id)) groups.set(id, { id, name: row.item_name, storeId: row.store,
      storeName: names[row.store] || row.store, unit: row.unit || '', source: row.source,
      format: explicitPackage(row.item_name) || (row.size ? `${row.size} ${row.unit}`.trim() : null), points: [] });
    const variants = row.source === 'flipp' ? photos.get(photoKey(row.store, row.item_name, row.date_observed, price, row.unit || '', row.size || '')) : undefined;
    // An ambiguous or differently dated offer is never a substitute for proof.
    const photo = variants?.size === 1 ? variants.values().next().value : undefined;
    groups.get(id)!.points.push({ date: row.date_observed, price, ...photo });
  }
  const series = [...groups.values()];
  for (const item of series) item.points.sort((a, b) => a.date.localeCompare(b.date) || a.price - b.price);
  series.sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name, 'fr'));
  const dates = series.flatMap(item => item.points.map(point => point.date)).sort();
  return { source: 'archive', regionId: 'joliette', regionName: 'Joliette et les environs',
    observationCount: seen.size, from: dates[0], to: dates.at(-1), series };
}
export function identity(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Only a single, explicit package size qualifies. Mixed assortments and ranges don't.
export function explicitPackage(name: string): string | null {
  if (/\b(?:ou|or)\b|\d\s*[-/à]\s*\d/i.test(name)) return null;
  const matches = [...name.matchAll(/\b(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|lb|un\.?|unités?)\b/gi)];
  if (matches.length !== 1) return null;
  const [, count = '1', size, unit] = matches[0];
  return `${count}x${size.replace(',', '.')}${unit.toLowerCase().replace('.', '')}`;
}
export function evidenceFor(raw: RawDealItem, proof?: ProofFact): OfferEvidence {
  const reviewed = proof && Math.abs(proof.currentPrice - raw.current_price) < .001 ? proof : undefined;
  const unit = reviewed?.unit ?? raw.unit ?? null;
  const pack = explicitPackage(raw.item_name);
  const variable = unit && /^(lb|kg|100g|l)$/i.test(unit);
  const fixed = unit && /^(each|ea|unit|unité|pack|package)$/i.test(unit);
  // A price alone never confirms a package size or a comparable unit.
  const format = reviewed?.format ?? (variable ? `per:${unit.toLowerCase()}` : fixed && pack ? pack : null);
  const regular = reviewed?.regularPrice ?? raw.regular_price;
  return {
    identity: identity(raw.item_name), format, fetchedPrice: raw.current_price,
    verifiedPrice: reviewed?.verifiedPrice && Number.isFinite(reviewed.verifiedPrice) && reviewed.verifiedPrice > 0 ? reviewed.verifiedPrice : undefined,
    formatLabel: reviewed?.formatLabel ?? (pack ? pack.replace(/^1x/, '').replace('x', ' × ') : null),
    unit, member: reviewed?.member ?? false,
    // A reviewed regular price on this exact offer also applies to its assorted
    // packages. It does not make them comparable to a different store's sizes.
    regularPrice: (format || (reviewed?.regularPrice && fixed)) && regular && regular > raw.current_price ? regular : null,
    advertisedPercent: reviewed?.verifiedPrice && reviewed.verifiedPrice !== raw.current_price ? null
      : raw.flipp_discount_pct && raw.flipp_discount_pct > 0 && raw.flipp_discount_pct <= 90 ? raw.flipp_discount_pct : null,
    source: raw.source_image_url ?? raw.source_url ?? null,
    proofCrop: reviewed?.proofCrop ?? raw.source_proof_crop,
    quantity: reviewed?.quantity,
  };
}
function weekKey(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 3) % 7));
  return d.toISOString().slice(0, 10);
}
export function historicalEvidence(raw: RawDealItem, current: OfferEvidence, rows: HistoryRow[], weekStart: string): OfferEvidence['history'] {
  // Photo-only facts are specific to that flyer. Never apply them retroactively.
  const original = evidenceFor(raw);
  if (!original.format || original.format !== current.format || current.member) return undefined;
  const cutoff = new Date(`${weekStart}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 180);
  const observations = new Map<string, { date: string; price: number }>();
  for (const row of rows) {
    if (row.source !== 'flipp' || row.date_observed >= weekStart || row.date_observed < cutoff.toISOString().slice(0, 10)) continue;
    if (row.store !== raw.store_id || identity(row.item_name) !== current.identity) continue;
    const value = Number(row.price);
    if (!(value > 0)) continue;
    const past = evidenceFor({ store_id: row.store, store_name: '', item_name: row.item_name, current_price: value, unit: row.unit || undefined, confidence: 'HIGH' });
    if (past.format !== current.format) continue;
    const key = weekKey(row.date_observed);
    const previous = observations.get(key);
    if (!previous || row.date_observed > previous.date) observations.set(key, { date: row.date_observed, price: value });
  }
  const records = [...observations.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (records.length < 3) return undefined;
  const prices = records.map(row => row.price).sort((a, b) => a - b);
  const middle = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2;
  const dates = records.map(row => row.date).sort();
  return { median: Math.round(median * 100) / 100, low: prices[0], weeks: records.length, from: dates[0], to: dates[dates.length - 1], points: records };
}

// Exact product/store observations can still be browsed when past formats were
// not captured. They never qualify for a price recommendation or basket saving.
export function observedHistory(raw: RawDealItem, rows: HistoryRow[], weekStart: string): OfferEvidence['observations'] {
  const cutoff = new Date(`${weekStart}T12:00:00Z`);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
  const observations = new Map<string, { date: string; price: number }>();
  for (const row of rows) {
    if (row.source !== 'flipp' || row.store !== raw.store_id || identity(row.item_name) !== identity(raw.item_name) ||
        (row.unit || '') !== (raw.unit || '') || row.date_observed >= weekStart || row.date_observed < cutoff.toISOString().slice(0, 10)) continue;
    const price = Number(row.price);
    if (!(price > 0) || !Number.isFinite(price)) continue;
    const key = weekKey(row.date_observed);
    const previous = observations.get(key);
    if (!previous || row.date_observed > previous.date) observations.set(key, { date: row.date_observed, price });
  }
  const points = [...observations.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (!points.length) return undefined;
  return { from: points[0].date, to: points[points.length - 1].date, weeks: points.length, points };
}
