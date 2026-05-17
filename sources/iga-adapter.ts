import { FirecrawlBaseAdapter, parsePricesFromMarkdown } from './firecrawl-adapter.js';
import type { SourceAdapter, RawDealItem } from './source-adapter.js';

export class IgaAdapter extends FirecrawlBaseAdapter implements SourceAdapter {
  id = 'iga-firecrawl';
  store_id = 'iga-joliette';
  store_name = 'IGA Joliette';
  flyer_url = 'https://www.iga.net/fr/circulaires';

  // Disabled until robots.txt and terms of service are reviewed
  enabled = false;

  parseFlyer(markdown: string): RawDealItem[] {
    const items: RawDealItem[] = [];
    const priceItems = parsePricesFromMarkdown(markdown);

    for (const p of priceItems) {
      if (p.price < 0.50 || p.price > 100) continue;

      items.push({
        store_id: this.store_id,
        store_name: this.store_name,
        item_name: p.raw_text.substring(0, 80),
        current_price: p.price,
        unit: p.unit,
        source_url: this.flyer_url,
        confidence: 'MEDIUM',
      });
    }

    return items;
  }
}
