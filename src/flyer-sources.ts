import type { RawDealItem } from '../sources/source-adapter.js';

// Presentation metadata only. Keep prices, ranking and collected records intact.
export function buildFlyerSources(items: RawDealItem[]) {
  const flyers = new Map<string, {
    id: string; storeId: string; storeName: string; url: string;
    startsAt: string | null; endsAt: string | null; images: string[];
  }>();
  for (const item of items) {
    if (!item.source_url || !/^https?:\/\//i.test(item.source_url)) continue;
    if (item.source_system !== 'flipp' || !item.source_flyer_id) continue;
    const storeId = item.store_id === 'bonichoix-stemilie' ? 'bonichoix-joliette' : item.store_id;
    const key = `${storeId}:${item.source_flyer_id}`;
    let flyer = flyers.get(key);
    if (!flyer) {
      flyer = {
        id: item.source_flyer_id, storeId, storeName: storeId === 'bonichoix-joliette' ? 'BoniChoix' : item.store_name,
        url: item.source_url, startsAt: item.sale_start ?? null,
        endsAt: item.sale_end ?? null, images: [],
      };
      flyers.set(key, flyer);
    }
    if (item.sale_start && (!flyer.startsAt || item.sale_start < flyer.startsAt)) flyer.startsAt = item.sale_start;
    if (item.sale_end && (!flyer.endsAt || item.sale_end > flyer.endsAt)) flyer.endsAt = item.sale_end;
    if (item.source_image_url && flyer.images.length < 3 && !flyer.images.includes(item.source_image_url)) {
      flyer.images.push(item.source_image_url);
    }
  }
  return [...flyers.values()].sort((a, b) => a.storeName.localeCompare(b.storeName, 'fr'));
}
