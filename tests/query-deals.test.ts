import { describe, it, expect } from 'vitest';
import { queryDeals } from '../src/query-deals.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dirname, '..', 'data', 'last-week-scored.json');

describe('queryDeals', () => {
  it('does not match "fraises" to generic "frais" poultry items', () => {
    mkdirSync(dirname(CACHE_PATH), { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify({
      generated_at: '2026-05-17T00:00:00.000Z',
      report_variant: 'live',
      deals: [
        {
          store_id: 'maxi-joliette',
          store_name: 'Maxi Joliette',
          item_name: 'FRAISES',
          normalized_name: 'fraises',
          category: 'fruits',
          current_price: 4.49,
          source_system: 'flipp',
          source_type: 'flyer',
          source_url: 'https://example.com/fraises',
          confidence: 'HIGH',
          score: 80,
          label: 'GREAT_DEAL',
          french_label: 'Très bon prix',
          french_reason: 'Bon prix',
          worth_buying: true,
        },
        {
          store_id: 'superc-joliette',
          store_name: 'Super C Joliette',
          item_name: 'Poitrines de poulet frais',
          normalized_name: 'poitrine de poulet',
          category: 'viande',
          current_price: 2.99,
          source_system: 'flipp',
          source_type: 'flyer',
          source_url: 'https://example.com/poulet',
          confidence: 'HIGH',
          score: 50,
          label: 'NOT_ENOUGH_HISTORY',
          french_label: 'Premier aperçu',
          french_reason: 'Premier aperçu',
          worth_buying: false,
        },
      ],
    }, null, 2), 'utf-8');

    const report = queryDeals(['fraises']);
    expect(report).toContain('FRAISES');
    expect(report).not.toContain('Poitrines de poulet frais');
  });

  it('filters obvious household items from query results', () => {
    mkdirSync(dirname(CACHE_PATH), { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify({
      generated_at: '2026-05-17T00:00:00.000Z',
      report_variant: 'live',
      deals: [
        {
          store_id: 'metro-joliette',
          store_name: 'Metro Joliette',
          item_name: 'ASSOUPLISSEUR DE TISSUS FLEECY',
          normalized_name: 'assouplisseur de tissus fleecy',
          category: 'epicerie',
          current_price: 5.99,
          source_system: 'flipp',
          source_type: 'flyer',
          source_url: 'https://example.com/fleecy',
          confidence: 'HIGH',
          score: 80,
          label: 'GREAT_DEAL',
          french_label: 'Très bon prix',
          french_reason: 'Bon prix',
          worth_buying: true,
        },
      ],
    }, null, 2), 'utf-8');

    const report = queryDeals(['fleecy']);
    expect(report).not.toContain('ASSOUPLISSEUR DE TISSUS FLEECY');
  });
});
