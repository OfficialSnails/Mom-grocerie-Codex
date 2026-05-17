import { FirecrawlBaseAdapter } from './firecrawl-adapter.js';
import type { SourceAdapter, RawDealItem } from './source-adapter.js';
import { parsePrice } from '../src/normalize-price.js';

interface BoniChoixFlyerItem {
  item_name?: string;
  name?: string;
  brand?: string;
  current_price?: number | string;
  sale_price?: number | string;
  price?: number | string;
  regular_price?: number | string;
  original_price?: number | string;
  size?: string;
  unit?: string;
  category?: string;
}

const JSON_PROMPT = `Extract ALL grocery sale items from this BoniChoix weekly flyer page. Return a JSON array. Each item: item_name (product name IN FRENCH, short and clean like "Poulet entier", "Pommes Gala", "Lait 2%"), brand (or empty string), current_price (sale price as number), regular_price (regular price as number or null), size (like "454g", "1 kg", "2 L"), unit (kg/lb/L/g/ml/each — the unit the price is per), category (viande/poisson/fruits/legumes/epicerie/congeles/produits-laitiers/boulangerie/boissons/autre). Only items on sale.`;

export class BoniChoixJolietteAdapter extends FirecrawlBaseAdapter implements SourceAdapter {
  id = 'bonichoix-joliette-firecrawl';
  store_id = 'bonichoix-joliette';
  store_name = 'BoniChoix Joliette';
  flyer_url = 'https://www.bonichoix.com/fr/circulaire/?store_id=78559';
  enabled = false; // replaced by FlippAdapter (covers all Joliette stores)

  private toRawDealItem(item: BoniChoixFlyerItem): RawDealItem | null {
    const name = item.item_name ?? item.name;
    if (!name || typeof name !== 'string') return null;

    const rawPrice = item.current_price ?? item.sale_price ?? item.price;
    const price = typeof rawPrice === 'number' ? rawPrice : parsePrice(String(rawPrice ?? ''));
    if (!price || price <= 0 || price > 200) return null;

    const rawRegular = item.regular_price ?? item.original_price;
    const regularPrice = typeof rawRegular === 'number' ? rawRegular : (rawRegular ? parsePrice(String(rawRegular)) : null);

    return {
      store_id: this.store_id,
      store_name: this.store_name,
      item_name: String(name).trim(),
      brand: item.brand ?? undefined,
      current_price: price,
      regular_price: regularPrice ?? undefined,
      size: item.size ?? undefined,
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

    const items = await this.scrapeAsJSON<BoniChoixFlyerItem>(this.flyer_url, JSON_PROMPT);
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
