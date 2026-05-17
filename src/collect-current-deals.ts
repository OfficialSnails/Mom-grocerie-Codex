import 'dotenv/config';
import type { RawDealItem } from '../sources/source-adapter.js';
import { CsvAdapter } from '../sources/csv-adapter.js';
import { MockAdapter } from '../sources/mock-adapter.js';
import { MetroAdapter } from '../sources/metro-adapter.js';
import { MaxiAdapter } from '../sources/maxi-adapter.js';
import { IgaAdapter } from '../sources/iga-adapter.js';
import { SuperCAdapter } from '../sources/superc-adapter.js';
import { BoniChoixAdapter } from '../sources/bonichoix-adapter.js';
import { BoniChoixJolietteAdapter } from '../sources/bonichoix-joliette-adapter.js';
import { FlippAdapter } from '../sources/flipp-adapter.js';
import { logSkippedSource } from './source-safety.js';
import { cleanItemName, normalizeString } from './normalize-product.js';

const ALL_ADAPTERS = [
  new CsvAdapter(),
  new MetroAdapter(),
  new MaxiAdapter(),
  new IgaAdapter(),
  new SuperCAdapter(),
  new BoniChoixJolietteAdapter(),
  new BoniChoixAdapter(),
  new FlippAdapter(),
];

// MockAdapter used only when no other adapter has data
const MOCK = new MockAdapter();

function dealLookupKey(item: RawDealItem): string {
  const base = item.normalized_name && item.normalized_name.trim().length > 0
    ? item.normalized_name
    : cleanItemName(item.item_name);
  return normalizeString(base);
}

function enrichManualItemsWithFlyerProof(items: RawDealItem[]): RawDealItem[] {
  const flyerCandidates = items.filter(item =>
    item.source_system === 'flipp' &&
    item.source_type === 'flyer' &&
    item.source_image_url
  );

  if (flyerCandidates.length === 0) return items;

  const flyerMap = new Map<string, RawDealItem[]>();
  for (const item of flyerCandidates) {
    const key = `${item.store_id}::${dealLookupKey(item)}`;
    if (!flyerMap.has(key)) flyerMap.set(key, []);
    flyerMap.get(key)!.push(item);
  }

  let enrichedCount = 0;
  const enriched = items.map(item => {
    if (item.source_system !== 'csv' || item.source_type !== 'manual' || item.source_image_url) {
      return item;
    }

    const key = `${item.store_id}::${dealLookupKey(item)}`;
    const matches = flyerMap.get(key) ?? [];
    if (matches.length === 0) return item;

    const best = [...matches].sort((a, b) =>
      Math.abs(a.current_price - item.current_price) - Math.abs(b.current_price - item.current_price)
    )[0];
    if (!best?.source_image_url) return item;

    enrichedCount += 1;
    return {
      ...item,
      source_image_url: best.source_image_url,
      source_url: item.source_url ?? best.source_url,
      source_flyer_id: item.source_flyer_id ?? best.source_flyer_id,
      source_flyer_name: item.source_flyer_name ?? best.source_flyer_name,
      source_item_id: item.source_item_id ?? best.source_item_id,
      source_raw_name: item.source_raw_name ?? best.source_raw_name,
      source_raw_price: item.source_raw_price ?? best.source_raw_price,
      notes: item.notes
        ? `${item.notes} | preuve Flipp auto-associée`
        : 'preuve Flipp auto-associée',
    };
  });

  if (enrichedCount > 0) {
    console.log(`[collect] enrichissement preuve: ${enrichedCount} entrées manuelles ont reçu une preuve visuelle Flipp`);
  }

  return enriched;
}

export async function collectCurrentDeals(): Promise<{
  items: RawDealItem[];
  usedMock: boolean;
  skippedAdapters: string[];
  sourceSummary: Record<string, number>;
  hasLiveFlyerData: boolean;
}> {
  const allItems: RawDealItem[] = [];
  const skippedAdapters: string[] = [];
  const sourceSummary: Record<string, number> = {};

  for (const adapter of ALL_ADAPTERS) {
    if (!adapter.enabled) {
      logSkippedSource(adapter.id, 'Adaptateur désactivé — activez-le dans source_status.json');
      skippedAdapters.push(adapter.id);
      continue;
    }

    try {
      const items = await adapter.collect();
      if (items.length > 0) {
        console.log(`[collect] ${adapter.id}: ${items.length} articles collectés`);
        allItems.push(...items);
        sourceSummary[adapter.id] = items.length;
      } else {
        console.log(`[collect] ${adapter.id}: aucun article trouvé`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[collect] ${adapter.id} erreur: ${msg}`);
      skippedAdapters.push(adapter.id);
    }
  }

  // Fall back to mock if nothing collected
  let usedMock = false;
  if (allItems.length === 0) {
    console.log('[collect] Aucune donnée collectée — utilisation des données de démonstration');
    const mockItems = await MOCK.collect();
    allItems.push(...mockItems);
    sourceSummary[MOCK.id] = mockItems.length;
    usedMock = true;
  }

  const enrichedItems = enrichManualItemsWithFlyerProof(allItems);

  const hasLiveFlyerData = enrichedItems.some(item =>
    item.source_type === 'flyer' && item.source_system !== 'mock'
  );

  return { items: enrichedItems, usedMock, skippedAdapters, sourceSummary, hasLiveFlyerData };
}

// Run directly: tsx src/collect-current-deals.ts
if (process.argv[1]?.endsWith('collect-current-deals.ts') || process.argv[1]?.endsWith('collect-current-deals.js')) {
  const { items, usedMock, skippedAdapters, sourceSummary, hasLiveFlyerData } = await collectCurrentDeals();

  console.log(`\n✅ ${items.length} articles collectés${usedMock ? ' (données de démonstration)' : ''}`);
  console.log(`📦 Sources: ${Object.entries(sourceSummary).map(([id, count]) => `${id}=${count}`).join(', ') || 'aucune'}`);
  console.log(`🧾 Données circulaire live: ${hasLiveFlyerData ? 'oui' : 'non'}`);

  if (skippedAdapters.length > 0) {
    console.log(`\n⚠️  Sources ignorées:`);
    for (const id of skippedAdapters) {
      console.log(`   - ${id}`);
    }
  }
}
