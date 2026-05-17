import { FirecrawlBaseAdapter, parsePricesFromMarkdown } from './firecrawl-adapter.js';
import type { SourceAdapter, RawDealItem } from './source-adapter.js';

export class BoniChoixAdapter extends FirecrawlBaseAdapter implements SourceAdapter {
  id = 'bonichoix-firecrawl';
  store_id = 'bonichoix-stemilie';
  store_name = "BoniChoix St-Émilie-de-l'Énergie";
  flyer_url = 'https://www.bonichoix.ca/circulaire';

  // Disabled — BoniChoix may not have a digital flyer; review first
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
