import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { format, startOfWeek } from 'date-fns';
import Papa from 'papaparse';
import type { ScoredDeal } from './generate-report.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURRENT_PATH = join(__dirname, '..', 'data', 'current_week_prices.csv');
const HISTORICAL_PATH = join(__dirname, '..', 'data', 'historical_prices.csv');

interface HistoricalRow {
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

interface CurrentRow {
  week_start_date: string;
  week_end_date: string;
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

function loadCSV<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const content = readFileSync(path, 'utf-8');
  const result = Papa.parse<T>(content, { header: true, skipEmptyLines: true });
  return result.data;
}

function saveCSV<T extends Record<string, unknown>>(path: string, rows: T[]): void {
  const csv = Papa.unparse(rows);
  writeFileSync(path, csv, 'utf-8');
}

export function updateHistory(): void {
  const current = loadCSV<CurrentRow>(CURRENT_PATH);
  const historical = loadCSV<HistoricalRow>(HISTORICAL_PATH);

  if (current.length === 0) {
    console.log('Aucune donnée dans current_week_prices.csv — rien à ajouter.');
    return;
  }

  const existingKeys = new Set(
    historical.map(r => `${r.date_observed}::${r.store}::${r.normalized_name || r.item_name}`)
  );

  const toAdd: HistoricalRow[] = [];

  for (const row of current) {
    if (!row.week_start_date || !row.store || !row.price) continue;

    const dateObserved = row.week_start_date;
    const key = `${dateObserved}::${row.store}::${row.normalized_name || row.item_name}`;

    if (existingKeys.has(key)) continue;

    toAdd.push({
      date_observed: dateObserved,
      store: row.store,
      item_name: row.item_name ?? '',
      normalized_name: row.normalized_name ?? '',
      brand: row.brand ?? '',
      category: row.category ?? '',
      price: row.price,
      size: row.size ?? '',
      unit: row.unit ?? '',
      normalized_price_per_unit: row.normalized_price_per_unit ?? '',
      normalized_unit: row.normalized_unit ?? '',
      source: row.source ?? 'csv-manual',
      notes: row.notes ?? '',
    });
    existingKeys.add(key);
  }

  if (toAdd.length === 0) {
    console.log("Toutes les données de cette semaine sont déjà dans l'historique.");
    return;
  }

  const updated = [...historical, ...toAdd];
  saveCSV(HISTORICAL_PATH, updated as Record<string, unknown>[]);

  console.log(`✅ ${toAdd.length} entrée(s) ajoutée(s) à l'historique.`);
  console.log(`📊 Total historique : ${updated.length} entrées.`);
}

export function persistScoredDeals(deals: ScoredDeal[], weekDate: Date = new Date()): void {
  const historical = loadCSV<HistoricalRow>(HISTORICAL_PATH);

  const existingKeys = new Set(
    historical.map(r => `${r.date_observed}::${r.store}::${r.normalized_name || r.item_name}`)
  );

  const weekStart = format(startOfWeek(weekDate, { weekStartsOn: 4 }), 'yyyy-MM-dd'); // Thursday
  const toAdd: HistoricalRow[] = [];

  for (const deal of deals) {
    if (!deal.item_name || deal.current_price <= 0) continue;
    if (['LOW_CONFIDENCE'].includes(deal.label) && !deal.normalized_price_per_unit) continue;

    // Use sale_start date if available (more accurate than run date)
    const dateObserved = deal.sale_start
      ? deal.sale_start.slice(0, 10)
      : weekStart;

    const name = deal.normalized_name ?? deal.matched_product?.normalized_name ?? deal.item_name;
    const key = `${dateObserved}::${deal.store_id}::${name}`;
    if (existingKeys.has(key)) continue;

    toAdd.push({
      date_observed: dateObserved,
      store: deal.store_id,
      item_name: deal.item_name,
      normalized_name: name,
      brand: deal.brand ?? '',
      category: deal.category ?? '',
      price: String(deal.current_price),
      size: deal.size ?? '',
      unit: deal.unit ?? '',
      normalized_price_per_unit: deal.normalized_price_per_unit != null
        ? String(deal.normalized_price_per_unit)
        : '',
      normalized_unit: deal.normalized_unit ?? '',
      source: deal.source_system ?? 'unknown',
      notes: deal.source_flyer_name ?? deal.notes ?? '',
    });
    existingKeys.add(key);
  }

  if (toAdd.length === 0) {
    console.log("Historique déjà à jour pour ces articles.");
    return;
  }

  const updated = [...historical, ...toAdd];
  saveCSV(HISTORICAL_PATH, updated as unknown as Record<string, unknown>[]);

  console.log(`✅ ${toAdd.length} article(s) ajouté(s) à l'historique depuis Flipp.`);
  console.log(`📊 Total historique : ${updated.length} entrées.`);
}

// Run directly when called as a script
if (process.argv[1]?.endsWith('update-history.ts') || process.argv[1]?.endsWith('update-history.js')) {
  updateHistory();
}
