import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import type { SourceAdapter, RawDealItem } from './source-adapter.js';
import { datedRowOverlapsRange, flyerWeekRangeForSourceRun, formatLocalDateOnly } from '../src/date-ranges.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'data', 'current_week_prices.csv');

interface CsvRow {
  week_start_date: string;
  week_end_date: string;
  store: string;
  item_name: string;
  normalized_name: string;
  brand: string;
  category: string;
  current_price: string;
  size: string;
  unit: string;
  normalized_price_per_unit: string;
  normalized_unit: string;
  source_url: string;
  source_image_url?: string;
  confidence_score: string;
  notes: string;
}

function mapConfidence(score: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  const s = score.toUpperCase();
  if (s === 'HIGH') return 'HIGH';
  if (s === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
}

export function isCsvRowActiveForTargetWeek(row: Pick<CsvRow, 'week_start_date' | 'week_end_date'>, runDate = new Date()): boolean {
  return datedRowOverlapsRange(row.week_start_date, row.week_end_date, flyerWeekRangeForSourceRun(runDate));
}

// Map store CSV id to store config id
function resolveStoreId(csvStore: string): string {
  const map: Record<string, string> = {
    'metro-joliette': 'metro-joliette',
    'maxi-joliette': 'maxi-joliette',
    'iga-joliette': 'iga-joliette',
    'superc-joliette': 'superc-joliette',
    'bonichoix-stemilie': 'bonichoix-stemilie',
  };
  return map[csvStore] ?? csvStore;
}

// Map store id to display name
function resolveStoreName(storeId: string): string {
  const map: Record<string, string> = {
    'metro-joliette': 'Metro Joliette',
    'maxi-joliette': 'Maxi Joliette',
    'iga-joliette': 'IGA Joliette',
    'superc-joliette': 'Super C Joliette',
    'bonichoix-stemilie': "BoniChoix St-Émilie-de-l'Énergie",
  };
  return map[storeId] ?? storeId;
}

export class CsvAdapter implements SourceAdapter {
  id = 'csv';
  store_id = 'all';
  enabled = true;

  async collect(): Promise<RawDealItem[]> {
    if (!existsSync(DATA_PATH)) {
      console.warn(`[csv-adapter] Fichier introuvable: ${DATA_PATH}`);
      return [];
    }

    const raw = readFileSync(DATA_PATH, 'utf-8');
    const result = Papa.parse<CsvRow>(raw, { header: true, skipEmptyLines: true });

    if (result.errors.length > 0) {
      console.warn('[csv-adapter] Erreurs CSV:', result.errors.slice(0, 3));
    }

    const targetRange = flyerWeekRangeForSourceRun();
    let skippedExpired = 0;

    const items = result.data
      .filter(row => row.item_name && row.current_price)
      .filter(row => {
        const active = datedRowOverlapsRange(row.week_start_date, row.week_end_date, targetRange);
        if (!active) skippedExpired += 1;
        return active;
      })
      .map(row => {
        const storeId = resolveStoreId(row.store);
        const price = parseFloat(row.current_price);
        if (isNaN(price)) return null;

        return {
          store_id: storeId,
          store_name: resolveStoreName(storeId),
          item_name: row.item_name,
          normalized_name: row.normalized_name || undefined,
          brand: row.brand || undefined,
          category: row.category || undefined,
          current_price: price,
          size: row.size || undefined,
          unit: row.unit || undefined,
          source_url: row.source_url || undefined,
          source_image_url: row.source_image_url || undefined,
          source_system: 'csv',
          source_type: 'manual',
          source_raw_name: row.item_name,
          source_raw_price: row.current_price,
          confidence: mapConfidence(row.confidence_score),
          week_start: row.week_start_date || undefined,
          week_end: row.week_end_date || undefined,
          sale_start: row.week_start_date || undefined,
          sale_end: row.week_end_date || undefined,
          notes: row.notes || undefined,
        } satisfies RawDealItem;
      })
      .filter((item): item is RawDealItem => item !== null);

    if (skippedExpired > 0) {
      console.log(
        `[csv-adapter] ${skippedExpired} entrée(s) manuelle(s) ignorée(s): dates hors semaine cible ${formatLocalDateOnly(targetRange.start)} -> ${formatLocalDateOnly(targetRange.end)}.`,
      );
    }

    return items;
  }
}
