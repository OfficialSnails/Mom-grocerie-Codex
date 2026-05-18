import { describe, expect, it } from 'vitest';
import { estimateBasketTotal, estimateCaveat, estimateItemPrice, formatEstimateCad, isVariablePrice } from '../src/price-estimate.js';

describe('price estimate calculator', () => {
  it('counts fixed prices toward the estimated total', () => {
    const estimate = estimateBasketTotal([
      { price: '2,99 $', currentPrice: 2.99 },
      { price: '4,49 $', currentPrice: 4.49 },
    ]);

    expect(estimate.fixedCount).toBe(2);
    expect(estimate.variableCount).toBe(0);
    expect(estimate.unknownCount).toBe(0);
    expect(estimate.subtotal).toBeCloseTo(7.48);
    expect(formatEstimateCad(estimate.subtotal)).toBe('7,48 $');
  });

  it('excludes weight and per-unit prices from the subtotal', () => {
    const items = [
      { price: '4,99 $/kg', currentPrice: 4.99, unit: 'kg' },
      { price: '3,49 $/lb', currentPrice: 3.49, unit: 'lb' },
      { price: '3,59 $/100g', currentPrice: 3.59, unit: '100g' },
    ];

    expect(items.every(isVariablePrice)).toBe(true);
    const estimate = estimateBasketTotal(items);

    expect(estimate.fixedCount).toBe(0);
    expect(estimate.variableCount).toBe(3);
    expect(estimate.subtotal).toBe(0);
    expect(estimateCaveat(estimate)).toBe('+ 3 produits au poids ou au format variable non inclus.');
  });

  it('separates fixed, variable, and unknown prices in a mixed basket', () => {
    const estimate = estimateBasketTotal([
      { price: '2,99 $', currentPrice: 2.99 },
      { price: '4,99 $/kg', currentPrice: 4.99, unit: 'kg' },
      { price: 'Prix à vérifier' },
    ]);

    expect(estimate.fixedCount).toBe(1);
    expect(estimate.variableCount).toBe(1);
    expect(estimate.unknownCount).toBe(1);
    expect(estimate.subtotal).toBeCloseTo(2.99);
    expect(estimateCaveat(estimate)).toBe('+ 1 produit au poids ou au format variable + 1 prix à vérifier non inclus.');
  });

  it('falls back to parsing display price when currentPrice is missing', () => {
    expect(estimateItemPrice({ price: '10,00 $' })).toBe(10);
    expect(estimateItemPrice({ price: '2/5,00 $' })).toBe(5);
    expect(estimateItemPrice({ price: '10,00 $/kg' })).toBeNull();
  });
});
