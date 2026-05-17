import { FirecrawlBaseAdapter } from './firecrawl-adapter.js';
import type { SourceAdapter, RawDealItem } from './source-adapter.js';
import { parsePrice } from '../src/normalize-price.js';

interface MetroFlyerItem {
  item_name?: string;
  name?: string;
  brand?: string;
  current_price?: number | string;
  sale_price?: number | string;
  price?: number | string;
  regular_price?: number | string;
  original_price?: number | string;
  size?: string;
  unit_or_size?: string;
  unit?: string;
  category?: string;
}

const JSON_PROMPT = `Extract all grocery sale items from this Metro weekly flyer page. Return a JSON array where each item has: item_name (product name IN FRENCH — translate from English if needed, keep it short and clear like "Beurre salé", "Filet de saumon", "Fraises"), brand (brand name or empty string), current_price (sale price as a number), regular_price (regular/usual price as a number or null), size (package size like "454g", "1 kg", "2 L", "500 ml"), unit (price unit: kg/lb/L/g/ml/each — the unit the price is per), category (one of: viande/poisson/fruits/legumes/epicerie/congeles/produits-laitiers/boulangerie/boissons/autre). Only include items that are on sale with a visible price.`;

export class MetroAdapter extends FirecrawlBaseAdapter implements SourceAdapter {
  id = 'metro-firecrawl';
  store_id = 'metro-joliette';
  store_name = 'Metro Joliette';
  flyer_url = 'https://www.metro.ca/epicerie-en-ligne/circulaire';
  enabled = false; // replaced by FlippAdapter (covers all Joliette stores)

  private toRawDealItem(item: MetroFlyerItem): RawDealItem | null {
    const name = item.item_name ?? item.name;
    if (!name || typeof name !== 'string') return null;

    const rawPrice = item.current_price ?? item.sale_price ?? item.price;
    const price = typeof rawPrice === 'number' ? rawPrice : parsePrice(String(rawPrice ?? ''));
    if (!price || price <= 0 || price > 200) return null;

    const rawRegular = item.regular_price ?? item.original_price;
    const regularPrice = typeof rawRegular === 'number' ? rawRegular : (rawRegular ? parsePrice(String(rawRegular)) : null);

    const size = item.size ?? item.unit_or_size;

    return {
      store_id: this.store_id,
      store_name: this.store_name,
      item_name: String(name).trim(),
      brand: item.brand ?? undefined,
      current_price: price,
      regular_price: regularPrice ?? undefined,
      size: size ?? undefined,
      unit: item.unit ?? undefined,
      category: item.category ?? undefined,
      source_url: this.flyer_url,
      confidence: 'HIGH',
    };
  }

  async collect(): Promise<RawDealItem[]> {
    if (!this.enabled) {
      console.log(`[${this.id}] Adaptateur désactivé — ignoré`);
      return [];
    }

    const items = await this.scrapeAsJSON<MetroFlyerItem>(this.flyer_url, JSON_PROMPT);
    if (!items) return [];

    const results: RawDealItem[] = [];
    for (const item of items) {
      const deal = this.toRawDealItem(item);
      if (deal) results.push(deal);
    }

    console.log(`[${this.id}] ${results.length} article(s) collecté(s)`);
    return results;
  }
}
