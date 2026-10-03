import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { classifyShopperCategory, SHOPPER_CATEGORIES, type ScoredDeal } from './generate-report.js';
import { evidenceFor, identity, type ProofFact } from './offer-evidence.js';
import { expandedProofCrop } from './proof-crop.js';
import type { RawDealItem } from '../sources/source-adapter.js';
// @ts-expect-error Shared static browser module.
import { prepareOfferIds } from '../website/offer-identity.js';

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const signature = (item: any) => JSON.stringify([item.id, item.name, item.storeId, item.currentPrice, item.unit, item.proofImageUrl]);
const sourceKey = (item: any) => JSON.stringify([identity(item.name), item.sourceStoreId ?? item.storeId, item.currentPrice, item.proofImageUrl]);

// Reassign existing offers without rescoring, deduplicating, changing IDs or
// replacing prices. This is also the dry-run path used before writing a repair.
export function regroupCategories(categories: any[], sourceFor: (item: any) => RawDealItem | undefined) {
  const groups = new Map<string, any[]>();
  for (const category of categories) for (const item of category.items) {
    const source = sourceFor(item);
    const id = source ? classifyShopperCategory(source as ScoredDeal) : category.id;
    // A category repair must never silently delete a source offer.
    const target = SHOPPER_CATEGORIES.find(c => c.id === id) ?? category;
    if (!groups.has(target.id)) groups.set(target.id, []);
    groups.get(target.id)!.push({ ...item, categoryId: target.id, categoryTitle: target.title,
      ...(source?.source_raw_name ? { source_raw_name: source.source_raw_name } : {}) });
  }
  return SHOPPER_CATEGORIES.filter(c => groups.has(c.id)).map(c => ({
    ...(categories.find(original => original.id === c.id) ?? { id: c.id, title: c.title }), items: groups.get(c.id),
  }));
}

export async function refreshOfferQuality(write = false) {
  const registry = read(resolve('website/data/regions.json')).regions;
  const facts: Record<string, ProofFact> = read(resolve('data/offer-proof-facts.json')).proofs;
  const details = new Map<string, Promise<any>>();
  const pending: Array<{ path: string; data: any }> = [];
  const receipts = [];
  for (const region of registry) {
    const meta = read(resolve('website', region.indexPath)).weeks[0];
    const path = resolve('website', meta.path);
    const week = prepareOfferIds(read(path));
    const originals = structuredClone(week);
    const weekStart = week.allCategories[0].items[0].id.slice(0, 10);
    const rawPath = region.id === 'joliette'
      ? resolve('reports/weeks', week.folderName, 'Autres/raw-items.json')
      : resolve('reports/regions', region.id, weekStart, 'raw-items.json');
    const raw: RawDealItem[] = read(rawPath);
    const flyers = read(resolve(dirname(path), 'flyers.json')).flyers;
    for (const flyer of flyers) if (!details.has(flyer.id)) {
      details.set(flyer.id, fetch(`https://backflipp.wishabi.com/flipp/flyers/${encodeURIComponent(flyer.id)}?locale=fr-CA&include=page_items`,
        { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json', Referer: 'https://flipp.com/' } })
        .then(async response => { if (!response.ok) throw new Error(`Source metadata HTTP ${response.status}: ${flyer.id}`); return response.json(); }));
    }
    for (const source of raw) {
      const flyer = flyers.find((f: any) => f.id === source.source_flyer_id);
      if (!flyer) continue;
      const detail = await details.get(flyer.id);
      const item = detail.items?.find((i: any) => String(i.id) === source.source_item_id);
      // Only use metadata for the exact stored offer. Live prices are never imported.
      if (!item || item.cutout_image_url?.replace(/^http:/, 'https:') !== source.source_image_url ||
        Number(item.price) !== source.current_price || identity(item.name.split(' | ')[0]) !== identity(source.item_name)) continue;
      source.source_raw_name ??= item.name;
      source.source_proof_crop = expandedProofCrop(item, detail.items, flyer);
    }
    const bySource = new Map(raw.map(source => [JSON.stringify([identity(source.item_name), source.store_id, source.current_price, source.source_image_url]), source]));
    const sourceFor = (item: any) => bySource.get(sourceKey(item));
    for (const key of ['categories', 'dealCategories', 'allCategories']) {
      if (week[key]) week[key] = regroupCategories(week[key], sourceFor);
    }
    const before = prepareOfferIds(structuredClone(originals));
    const after = prepareOfferIds(structuredClone(week));
    for (const key of ['categories', 'dealCategories', 'allCategories']) {
      const preserved = (w: any) => (w[key] ?? []).flatMap((c: any) => c.items.map(signature)).sort();
      if (JSON.stringify(preserved(before)) !== JSON.stringify(preserved(after))) throw new Error(`Offer preservation check failed: ${region.id}/${key}`);
    }
    const evidencePath = resolve(dirname(path), 'offer-evidence.json');
    const evidence = read(evidencePath);
    const all = after.allCategories.flatMap((c: any) => c.items);
    for (const item of all) {
      const source = sourceFor(item);
      if (source) evidence.offers[item.id] = { ...evidence.offers[item.id], ...evidenceFor(source, facts[item.proofImageUrl]) };
    }
    const originalCategories = new Map(originals.allCategories.flatMap((c: any) => c.items.map((i: any) => [signature(i), c.id])));
    const moved = week.allCategories.flatMap((c: any) => c.items.filter((i: any) => originalCategories.get(signature(i)) !== c.id)
      .map((i: any) => ({ name: i.name, from: originalCategories.get(signature(i)), to: c.id })));
    receipts.push({ region: region.id, offers: all.length, moved, widerPhotos: all.filter((i: any) => evidence.offers[i.id]?.proofCrop).length });
    pending.push({ path, data: week }, { path: evidencePath, data: evidence });
  }
  // Complete every source/invariant check before writing any regional snapshot.
  if (write) for (const file of pending) writeFileSync(file.path, JSON.stringify(file.data, null, 2) + '\n');
  return { written: write, regions: receipts };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  refreshOfferQuality(process.argv.includes('--write')).then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
