export interface NormalizedPrice {
  price_per_unit: number;
  normalized_unit: 'kg' | 'L' | 'each' | 'unknown';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

// Parse French/English price string to number
// Handles: "4,99 $", "$4.99", "4.99", "4,99"
export function parsePrice(raw: string): number | null {
  const cleaned = raw
    .replace(/\s/g, '')
    .replace(/\$/g, '')
    .replace(',', '.');

  const val = parseFloat(cleaned);
  if (isNaN(val) || val <= 0 || val > 1000) return null;
  return val;
}

// Parse "2 pour 5,00 $" or "3 for $10" → { price_each, quantity }
export function parseMultiPricing(raw: string): { price_each: number; quantity: number } | null {
  const match = raw.match(/(\d+)\s+(?:pour|for)\s+\$?\s*(\d+[,.]?\d*)\s*\$?/i);
  if (!match) return null;

  const qty = parseInt(match[1]);
  const total = parseFloat(match[2].replace(',', '.'));

  if (qty <= 0 || isNaN(total) || total <= 0) return null;

  return {
    price_each: Math.round((total / qty) * 100) / 100,
    quantity: qty,
  };
}

// Convert lb price to kg price
export function lbToKg(price_per_lb: number): number {
  return Math.round(price_per_lb * 2.20462 * 100) / 100;
}

// Convert per-100g price to per-kg price
export function per100gToKg(price_per_100g: number): number {
  return Math.round(price_per_100g * 10 * 100) / 100;
}

// Normalize price to a standard unit for comparison
export function normalizePrice(
  price: number,
  size: string | undefined,
  unit: string | undefined
): NormalizedPrice {
  const u = (unit ?? '').toLowerCase().trim();
  const sizeNum = parseFloat((size ?? '1').replace(',', '.'));

  if (isNaN(sizeNum) || sizeNum <= 0) {
    return { price_per_unit: price, normalized_unit: 'unknown', confidence: 'LOW' };
  }

  // Already per kg
  if (u === 'kg') {
    return { price_per_unit: price, normalized_unit: 'kg', confidence: 'HIGH' };
  }

  // Per lb → convert to kg
  if (u === 'lb' || u === 'lbs') {
    return { price_per_unit: lbToKg(price), normalized_unit: 'kg', confidence: 'HIGH' };
  }

  // Grams → price per kg
  if (u === 'g' || u === 'gr') {
    if (sizeNum <= 0) return { price_per_unit: price, normalized_unit: 'unknown', confidence: 'LOW' };
    const per_kg = Math.round((price / sizeNum) * 1000 * 100) / 100;
    return { price_per_unit: per_kg, normalized_unit: 'kg', confidence: 'HIGH' };
  }

  // Per 100g → kg
  if (u === '100g') {
    return { price_per_unit: per100gToKg(price), normalized_unit: 'kg', confidence: 'HIGH' };
  }

  // Litres
  if (u === 'l' || u === 'litre' || u === 'litres') {
    if (sizeNum !== 1) {
      const per_l = Math.round((price / sizeNum) * 100) / 100;
      return { price_per_unit: per_l, normalized_unit: 'L', confidence: 'HIGH' };
    }
    return { price_per_unit: price, normalized_unit: 'L', confidence: 'HIGH' };
  }

  // Millilitres → L
  if (u === 'ml') {
    const per_l = Math.round((price / sizeNum) * 1000 * 100) / 100;
    return { price_per_unit: per_l, normalized_unit: 'L', confidence: 'HIGH' };
  }

  // Each/unit (eggs, packages, etc.)
  if (u === 'each' || u === 'unit' || u === 'chacun' || u === 'un' || u === 'pcs') {
    // If sizeNum > 1 it's a multipack — price per item
    if (sizeNum > 1) {
      const per_each = Math.round((price / sizeNum) * 100) / 100;
      return { price_per_unit: per_each, normalized_unit: 'each', confidence: 'MEDIUM' };
    }
    return { price_per_unit: price, normalized_unit: 'each', confidence: 'HIGH' };
  }

  // Unknown unit — return as-is with low confidence
  return { price_per_unit: price, normalized_unit: 'unknown', confidence: 'LOW' };
}

// Format price in French style: 4.88 → "4,88 $"
export function formatPriceFR(price: number): string {
  return `${price.toFixed(2).replace('.', ',')} $`;
}
