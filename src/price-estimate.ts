import { parsePrice, formatPriceFR } from './normalize-price.js';

export interface PriceEstimateItem {
  price?: string | null;
  currentPrice?: number | null;
  unit?: string | null;
}

export interface PriceEstimate {
  subtotal: number;
  fixedCount: number;
  variableCount: number;
  unknownCount: number;
  totalCount: number;
}

const VARIABLE_PRICE_UNITS = new Set(['kg', 'lb', 'lbs', '100g', 'l', 'litre', 'litres', 'rebate', 'rabais']);
const VARIABLE_PRICE_PATTERN = /\/\s*(?:kg|lb|lbs|100\s*g|g|l|litre|litres)\b/i;

export function isVariablePrice(item: PriceEstimateItem): boolean {
  const unit = String(item.unit ?? '').trim().toLowerCase();
  if (VARIABLE_PRICE_UNITS.has(unit)) return true;
  return VARIABLE_PRICE_PATTERN.test(String(item.price ?? ''));
}

function parseEstimatePrice(raw: string): number | null {
  const multi = raw.match(/\b\d+\s*(?:pour|for|\/)\s*\$?\s*(\d+(?:[,.]\d{1,2})?)/i);
  if (multi) return parsePrice(multi[1]);
  return parsePrice(raw);
}

export function estimateItemPrice(item: PriceEstimateItem): number | null {
  if (isVariablePrice(item)) return null;
  if (typeof item.currentPrice === 'number' && Number.isFinite(item.currentPrice) && item.currentPrice > 0) {
    return item.currentPrice;
  }
  return parseEstimatePrice(String(item.price ?? ''));
}

export function estimateBasketTotal(items: PriceEstimateItem[]): PriceEstimate {
  return items.reduce<PriceEstimate>((estimate, item) => {
    estimate.totalCount += 1;
    if (isVariablePrice(item)) {
      estimate.variableCount += 1;
      return estimate;
    }

    const price = estimateItemPrice(item);
    if (price == null) {
      estimate.unknownCount += 1;
      return estimate;
    }

    estimate.fixedCount += 1;
    estimate.subtotal += price;
    return estimate;
  }, {
    subtotal: 0,
    fixedCount: 0,
    variableCount: 0,
    unknownCount: 0,
    totalCount: 0,
  });
}

export function formatEstimateCad(value: number): string {
  return formatPriceFR(Math.round(value * 100) / 100);
}

export function estimateCaveat(estimate: Pick<PriceEstimate, 'variableCount' | 'unknownCount'>): string {
  const parts: string[] = [];
  if (estimate.variableCount > 0) {
    parts.push(`${estimate.variableCount} produit${estimate.variableCount > 1 ? 's' : ''} au poids ou au format variable`);
  }
  if (estimate.unknownCount > 0) {
    parts.push(`${estimate.unknownCount} prix à vérifier`);
  }
  return parts.length > 0 ? `+ ${parts.join(' + ')} non inclus.` : '';
}
