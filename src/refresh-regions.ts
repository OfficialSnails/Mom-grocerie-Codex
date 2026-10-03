import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { selectPrimaryFlyersForCycle, matchMerchant, parseItemPrice, inferUnitFromPrintId } from '../sources/flipp-adapter.js';
import { classifyShopperCategory, isCostcoGroceryRelevant, SHOPPER_CATEGORIES, type ScoredDeal } from './generate-report.js';
import { flyerPageMetadata } from './refresh-flyer-pages.js';
import { evidenceFor, type ProofFact } from './offer-evidence.js';
import { flyerWeekRangeForSourceRun, formatLocalDateOnly } from './date-ranges.js';
import type { RawDealItem } from '../sources/source-adapter.js';
import { expandedProofCrop } from './proof-crop.js';

const REGIONS = [
  { id: 'montreal', name: 'Montréal', postalCode: 'H2X1Y4' },
  { id: 'quebec', name: 'Québec', postalCode: 'G1R4P5' },
];
const BASE = 'https://backflipp.wishabi.com/flipp';
async function getJson(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json', Referer: 'https://flipp.com/' } });
  if (!response.ok) throw new Error(`Regional source HTTP ${response.status}`);
  return response.json();
}
export async function refreshRegions(now = new Date()) {
  const baseIndex = JSON.parse(readFileSync(resolve('website/data/weeks/index.json'), 'utf8'));
  const meta = baseIndex.weeks[0];
  const originalWeek = JSON.parse(readFileSync(resolve('website', meta.path), 'utf8'));
  const dates = flyerWeekRangeForSourceRun(now);
  const cycle = { start: formatLocalDateOnly(dates.start), end: formatLocalDateOnly(dates.end) };
  if (!originalWeek.dealCategories[0]?.items[0]?.id.startsWith(cycle.start)) throw new Error('Regional export needs a published week matching the current flyer cycle.');
  const proofFacts: Record<string, ProofFact> = JSON.parse(readFileSync(resolve('data/offer-proof-facts.json'), 'utf8')).proofs;
  const registry = [{ id: 'joliette', name: 'Joliette et les environs', postalCode: 'J6E3N2', indexPath: 'data/weeks/index.json' }];
  for (const region of REGIONS) {
    const catalog = await getJson(`${BASE}/flyers?locale=fr-CA&postal_code=${region.postalCode}`);
    const sources = selectPrimaryFlyersForCycle(catalog.flyers, now);
    if (!sources.length) throw new Error(`No current regional flyers: ${region.name}`);
    const weekPath = `data/regions/${region.id}/weeks/${meta.slug}`;
    const destination = resolve('website', weekPath);
    mkdirSync(destination, { recursive: true });
    const items: any[] = [], flyers: any[] = [], rawItems: RawDealItem[] = [], offers: Record<string, unknown> = {};
    const seen = new Set<string>();
    for (const source of sources) {
      const merchant = matchMerchant(source.merchant);
      if (!merchant) continue;
      const detail = await getJson(`${BASE}/flyers/${source.id}?locale=fr-CA&include=page_items`);
      const metadata = catalog.flyers.find((flyer: any) => flyer.id === source.id);
      const images = flyerPageMetadata(metadata, detail.pages ?? []);
      const storeId = `${merchant.store_id.replace(/-(joliette|quebec)$/, '')}-${region.id}`;
      const sourceUrl = `https://flipp.com/fr-ca/${region.id}-qc/flyer/${source.id}`;
      flyers.push({ id: String(source.id), storeId, storeName: merchant.store_name, url: sourceUrl, ...images });
      for (const input of detail.items ?? []) {
        const price = parseItemPrice(input.price);
        if (!price || price < .25 || input.valid_from.slice(0, 10) > cycle.end || input.valid_to.slice(0, 10) < cycle.start) continue;
        const name = input.name.split(' | ')[0].trim();
        const proof = input.cutout_image_url?.replace(/^http:/, 'https:');
        const raw: RawDealItem = { store_id: merchant.store_id, store_name: merchant.store_name, item_name: name, current_price: price,
          unit: inferUnitFromPrintId(input.print_id), brand: input.brand || undefined,
          flipp_discount_pct: input.discount > 0 && input.discount <= 90 ? input.discount : undefined,
          source_image_url: proof, source_url: sourceUrl, source_system: 'flipp', source_type: 'flyer',
          source_raw_name: input.name, source_raw_price: input.price,
          source_proof_crop: expandedProofCrop(input, detail.items, images),
          source_flyer_id: String(source.id), source_item_id: String(input.id), sale_start: input.valid_from, sale_end: input.valid_to, confidence: 'HIGH' };
        if (!isCostcoGroceryRelevant(raw)) continue;
        const categoryId = classifyShopperCategory(raw as ScoredDeal);
        if (!categoryId) continue;
        const signature = `${storeId}|${name}|${price}|${proof}`;
        if (seen.has(signature)) continue;
        seen.add(signature);
        const facts = evidenceFor(raw, proofFacts[proof]);
        const id = `${cycle.start}::${storeId}::${input.id}`;
        const category = SHOPPER_CATEGORIES.find(category => category.id === categoryId)!;
        const unitLabel = raw.unit && /^(lb|kg|100g|l)$/i.test(raw.unit) ? `/${raw.unit}` : '';
        const advertised = (raw.flipp_discount_pct ?? 0) >= 25 || Boolean(facts.regularPrice && facts.regularPrice > price);
        items.push({ id, name, storeId, sourceStoreId: storeId, storeName: merchant.store_name, storeAddress: '',
          categoryId, categoryTitle: category.title, price: `${price.toFixed(2).replace('.', ',')} $${unitLabel}`,
          currentPrice: price, unit: raw.unit ?? null, scale: unitLabel ? `Prix ${unitLabel}` : facts.formatLabel ?? 'Format à vérifier sur la photo.',
          comparisons: [], proofImageUrl: proof ?? null, proofUrl: proof ?? sourceUrl, sourceType: 'flyer', sourceSystem: 'flipp',
          saleStart: input.valid_from, saleEnd: input.valid_to, verificationConfidence: 'HIGH', itemKind: advertised ? 'deal' : 'seen',
          badgeLabel: advertised ? 'Rabais annoncé' : 'En circulaire' });
        offers[id] = facts;
        rawItems.push({ ...raw, store_id: storeId });
      }
    }
    if (!items.length) throw new Error(`No priced offers for ${region.name}`);
    const categories = (deals: boolean) => SHOPPER_CATEGORIES.map(category => ({ id: category.id, title: category.title,
      items: items.filter(item => item.categoryId === category.id && (!deals || item.itemKind === 'deal')) })).filter(category => category.items.length);
    const allCategories = categories(false), dealCategories = categories(true);
    const week = { schemaVersion: 1, slug: meta.slug, folderName: meta.folderName, title: `Liste d’épicerie — ${region.name} — ${meta.weekRange}`,
      regionId: region.id, regionName: region.name, sourcePostalCode: region.postalCode, weekRange: meta.weekRange,
      generatedAt: now.toISOString(), allItemCount: items.length, itemCount: items.filter(item => item.itemKind === 'deal').length,
      categories: dealCategories, dealCategories, allCategories, stores: flyers.map(f => ({ id: f.storeId, name: f.storeName })) };
    writeFileSync(join(destination, 'week.json'), JSON.stringify(week, null, 2) + '\n');
    writeFileSync(join(destination, 'flyers.json'), JSON.stringify({ flyers }, null, 2) + '\n');
    writeFileSync(join(destination, 'offer-evidence.json'), JSON.stringify({ generatedAt: now.toISOString(), weekStart: cycle.start, offers }, null, 2) + '\n');
    const receiptDir = resolve('reports/regions', region.id, cycle.start);
    mkdirSync(receiptDir, { recursive: true });
    writeFileSync(join(receiptDir, 'raw-items.json'), JSON.stringify(rawItems, null, 2) + '\n');
    const indexPath = `data/regions/${region.id}/weeks/index.json`;
    writeFileSync(resolve('website', indexPath), JSON.stringify({ generatedAt: now.toISOString(), weeks: [{ ...meta, ...week, categories: undefined, dealCategories: undefined, allCategories: undefined, stores: undefined, path: `${weekPath}/week.json` }] }, null, 2) + '\n');
    registry.push({ ...region, indexPath });
    console.log(`${region.name}: ${flyers.length} current flyers, ${items.length} offers, ${week.itemCount} advertised reductions.`);
  }
  writeFileSync(resolve('website/data/regions.json'), JSON.stringify({ generatedAt: now.toISOString(), regions: registry }, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) refreshRegions().catch(error => { console.error(error); process.exitCode = 1; });
