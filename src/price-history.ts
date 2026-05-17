import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { subDays, parseISO, isAfter } from 'date-fns';
import Papa from 'papaparse';
import { normalizeString } from './normalize-product.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = join(__dirname, '..', 'data', 'historical_prices.csv');

interface CsvHistoryRow {
  date_observed: string;
  store: string;
  item_name: string;
  normalized_name: string;
  brand: string;
  category: string;
  price: string;
  size: string;
  unit: string;
  normalized_price_per_unit: string;
  normalized_unit: string;
  source: string;
  notes: string;
}

export interface HistoricalEntry {
  date_observed: Date;
  store: string;
  normalized_name: string;
  price: number;
  normalized_price_per_unit: number;
  normalized_unit: string;
}

export interface PriceStats {
  count: number;
  avg_6mo: number | null;
  median_6mo: number | null;
  low_6mo: number | null;
  high_6mo: number | null;
  avg_4wk: number | null;
  low_30d: number | null;
  low_60d: number | null;
  has_enough_history: boolean;
}

let _historyCache: HistoricalEntry[] | null = null;

function loadAllHistory(): HistoricalEntry[] {
  if (_historyCache) return _historyCache;

  if (!existsSync(HISTORY_PATH)) {
    console.warn('[price-history] Fichier historique introuvable:', HISTORY_PATH);
    return [];
  }

  const raw = readFileSync(HISTORY_PATH, 'utf-8');
  const result = Papa.parse<CsvHistoryRow>(raw, { header: true, skipEmptyLines: true });

  _historyCache = result.data
    .filter(row => row.date_observed && row.normalized_name && row.normalized_price_per_unit)
    .map(row => {
      const price = parseFloat(row.normalized_price_per_unit);
      const date = parseISO(row.date_observed);
      if (isNaN(price) || isNaN(date.getTime())) return null;
      return {
        date_observed: date,
        store: row.store,
        normalized_name: normalizeString(row.normalized_name),
        price: parseFloat(row.price),
        normalized_price_per_unit: price,
        normalized_unit: row.normalized_unit,
      };
    })
    .filter((e): e is HistoricalEntry => e !== null);

  return _historyCache;
}

export function loadHistory(normalizedName: string, days: number): HistoricalEntry[] {
  const all = loadAllHistory();
  const cutoff = subDays(new Date(), days);
  const nameNorm = normalizeString(normalizedName);

  return all.filter(
    e => normalizeString(e.normalized_name) === nameNorm && isAfter(e.date_observed, cutoff)
  );
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function calcPriceStats(history: HistoricalEntry[]): PriceStats {
  if (history.length === 0) {
    return {
      count: 0,
      avg_6mo: null,
      median_6mo: null,
      low_6mo: null,
      high_6mo: null,
      avg_4wk: null,
      low_30d: null,
      low_60d: null,
      has_enough_history: false,
    };
  }

  const prices = history.map(e => e.normalized_price_per_unit);
  const now = new Date();
  const cutoff4wk = subDays(now, 28);
  const cutoff30d = subDays(now, 30);
  const cutoff60d = subDays(now, 60);

  const recent4wk = history.filter(e => isAfter(e.date_observed, cutoff4wk)).map(e => e.normalized_price_per_unit);
  const recent30d = history.filter(e => isAfter(e.date_observed, cutoff30d)).map(e => e.normalized_price_per_unit);
  const recent60d = history.filter(e => isAfter(e.date_observed, cutoff60d)).map(e => e.normalized_price_per_unit);

  return {
    count: history.length,
    avg_6mo: Math.round(avg(prices) * 100) / 100,
    median_6mo: Math.round(median(prices) * 100) / 100,
    low_6mo: Math.min(...prices),
    high_6mo: Math.max(...prices),
    avg_4wk: recent4wk.length > 0 ? Math.round(avg(recent4wk) * 100) / 100 : null,
    low_30d: recent30d.length > 0 ? Math.min(...recent30d) : null,
    low_60d: recent60d.length > 0 ? Math.min(...recent60d) : null,
    has_enough_history: history.length >= 3,
  };
}

export function pctBelow(current: number, reference: number): number {
  if (reference <= 0) return 0;
  return Math.round(((reference - current) / reference) * 100 * 10) / 10;
}

// Compute stats for a product — combines loadHistory + calcPriceStats
export function getProductStats(normalizedName: string): PriceStats {
  const history = loadHistory(normalizedName, 180);
  return calcPriceStats(history);
}
