import { describe, it, expect } from 'vitest';
import {
  parsePrice,
  parseMultiPricing,
  lbToKg,
  per100gToKg,
  normalizePrice,
  formatPriceFR,
} from '../src/normalize-price.js';

describe('parsePrice', () => {
  it('parses French format "4,99 $"', () => {
    expect(parsePrice('4,99 $')).toBe(4.99);
  });

  it('parses "$4.99"', () => {
    expect(parsePrice('$4.99')).toBe(4.99);
  });

  it('parses plain "4.99"', () => {
    expect(parsePrice('4.99')).toBe(4.99);
  });

  it('returns null for invalid string', () => {
    expect(parsePrice('abc')).toBeNull();
  });

  it('returns null for negative', () => {
    expect(parsePrice('-1.99')).toBeNull();
  });
});

describe('parseMultiPricing', () => {
  it('parses "2 pour 5,00 $"', () => {
    const result = parseMultiPricing('2 pour 5,00 $');
    expect(result?.price_each).toBe(2.5);
    expect(result?.quantity).toBe(2);
  });

  it('parses "3 for $10"', () => {
    const result = parseMultiPricing('3 for $10');
    expect(result?.price_each).toBeCloseTo(3.33, 1);
    expect(result?.quantity).toBe(3);
  });

  it('parses "3 pour 10 $"', () => {
    const result = parseMultiPricing('3 pour 10 $');
    expect(result?.price_each).toBeCloseTo(3.33, 1);
  });

  it('returns null for plain price', () => {
    expect(parseMultiPricing('4,99 $')).toBeNull();
  });
});

describe('lbToKg', () => {
  it('converts $4.99/lb to per kg', () => {
    expect(lbToKg(4.99)).toBeCloseTo(10.99, 0);
  });

  it('converts $2.00/lb correctly', () => {
    expect(lbToKg(2.0)).toBeCloseTo(4.41, 1);
  });
});

describe('per100gToKg', () => {
  it('converts $1.99/100g to per kg', () => {
    expect(per100gToKg(1.99)).toBeCloseTo(19.9, 0);
  });
});

describe('normalizePrice', () => {
  it('price per kg stays as-is', () => {
    const result = normalizePrice(8.99, '1', 'kg');
    expect(result.price_per_unit).toBe(8.99);
    expect(result.normalized_unit).toBe('kg');
    expect(result.confidence).toBe('HIGH');
  });

  it('converts 500g → price per kg: $4.99 for 500g = $9.98/kg', () => {
    const result = normalizePrice(4.99, '500', 'g');
    expect(result.price_per_unit).toBeCloseTo(9.98, 0);
    expect(result.normalized_unit).toBe('kg');
  });

  it('converts 454g (1lb) → price per kg: $4.88 for 454g', () => {
    const result = normalizePrice(4.88, '454', 'g');
    expect(result.price_per_unit).toBeCloseTo(10.75, 0);
    expect(result.normalized_unit).toBe('kg');
  });

  it('converts 2L → price per L: $3.99 for 2L = $2.00/L', () => {
    const result = normalizePrice(3.99, '2', 'L');
    expect(result.price_per_unit).toBeCloseTo(2.0, 0);
    expect(result.normalized_unit).toBe('L');
  });

  it('converts 1890ml → price per L: $5.49 for 1890ml', () => {
    const result = normalizePrice(5.49, '1890', 'ml');
    expect(result.normalized_unit).toBe('L');
    expect(result.price_per_unit).toBeGreaterThan(2);
    expect(result.price_per_unit).toBeLessThan(3);
  });

  it('handles each (12 eggs)', () => {
    const result = normalizePrice(4.99, '12', 'each');
    expect(result.normalized_unit).toBe('each');
    expect(result.price_per_unit).toBeCloseTo(0.42, 1);
  });

  it('returns unknown for unrecognized unit', () => {
    const result = normalizePrice(9.99, '1', 'bunch');
    expect(result.normalized_unit).toBe('unknown');
    expect(result.confidence).toBe('LOW');
  });
});

describe('formatPriceFR', () => {
  it('formats 4.88 as "4,88 $"', () => {
    expect(formatPriceFR(4.88)).toBe('4,88 $');
  });

  it('formats 12.99 as "12,99 $"', () => {
    expect(formatPriceFR(12.99)).toBe('12,99 $');
  });
});
