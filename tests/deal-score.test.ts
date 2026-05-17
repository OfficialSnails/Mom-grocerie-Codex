import { describe, it, expect } from 'vitest';
import { scoreDeal, toFrenchLabel } from '../src/deal-score.js';
import type { PriceStats } from '../src/price-history.js';

function makeStats(overrides: Partial<PriceStats> = {}): PriceStats {
  return {
    count: 10,
    avg_6mo: 7.49,
    median_6mo: 7.49,
    low_6mo: 4.77,
    high_6mo: 9.99,
    avg_4wk: 7.99,
    low_30d: null,
    low_60d: null,
    has_enough_history: true,
    ...overrides,
  };
}

describe('scoreDeal — chicken breast great deal', () => {
  // Current: $4.99/kg, avg: $7.49/kg → 33% below avg → STOCK_UP
  it('scores chicken at 4.99 vs avg 7.49 as STOCK_UP', () => {
    const stats = makeStats();
    const result = scoreDeal(4.99, stats, true, 'HIGH');
    expect(['STOCK_UP', 'MUST_BUY', 'GREAT_DEAL']).toContain(result.label);
    expect(result.worth_buying).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(75);
  });
});

describe('scoreDeal — fake sale (cereal)', () => {
  // Current: $5.99, avg: $6.29 → only 5% below → FAKE_SALE
  it('scores cereal at 5.99 vs avg 6.29 as FAKE_SALE', () => {
    const stats = makeStats({ avg_6mo: 6.29, median_6mo: 6.29, low_6mo: 5.79, high_6mo: 6.99 });
    const result = scoreDeal(5.99, stats, false, 'HIGH');
    expect(result.label).toBe('FAKE_SALE');
    expect(result.worth_buying).toBe(false);
  });
});

describe('scoreDeal — recent better price (grapes)', () => {
  // Current: $3.49/kg, avg: $3.99/kg, low_30d: $1.99/kg → WAIT
  it('scores grapes at 3.49 with low_30d 1.99 as WAIT', () => {
    const stats = makeStats({
      avg_6mo: 3.99,
      median_6mo: 3.85,
      low_6mo: 1.99,
      low_30d: 1.99,
    });
    const result = scoreDeal(3.49, stats, false, 'HIGH');
    expect(result.label).toBe('WAIT');
    expect(result.worth_buying).toBe(false);
  });
});

describe('scoreDeal — not enough history', () => {
  it('returns NOT_ENOUGH_HISTORY when count < 3', () => {
    const stats = makeStats({ count: 1, has_enough_history: false });
    const result = scoreDeal(4.99, stats, false, 'HIGH');
    expect(result.label).toBe('NOT_ENOUGH_HISTORY');
    expect(result.worth_buying).toBe(false);
  });
});

describe('scoreDeal — low confidence', () => {
  it('returns LOW_CONFIDENCE when confidence is LOW', () => {
    const stats = makeStats();
    const result = scoreDeal(4.99, stats, false, 'LOW');
    expect(result.label).toBe('LOW_CONFIDENCE');
    expect(result.worth_buying).toBe(false);
  });
});

describe('scoreDeal — butter stock up', () => {
  // Butter at $4.88 vs avg $6.29, low $4.77 → very close to 6mo low → STOCK_UP
  it('scores butter at 4.88 vs avg 6.29 as STOCK_UP', () => {
    const stats = makeStats({
      avg_6mo: 6.29,
      median_6mo: 6.29,
      low_6mo: 4.77,
      high_6mo: 7.49,
    });
    const result = scoreDeal(4.88, stats, true, 'HIGH');
    expect(['STOCK_UP', 'GREAT_DEAL']).toContain(result.label);
    expect(result.worth_buying).toBe(true);
  });
});

describe('scoreDeal — GOOD_IF_NEEDED', () => {
  // Current at the 6mo low, 25% below avg → score ~60 → GOOD_IF_NEEDED
  it('scores a moderate deal as GOOD_IF_NEEDED', () => {
    const stats = makeStats({ avg_6mo: 9.99, median_6mo: 9.99, low_6mo: 7.49, low_30d: null, low_60d: null });
    const result = scoreDeal(7.49, stats, false, 'HIGH');
    expect(['GOOD_IF_NEEDED', 'GREAT_DEAL']).toContain(result.label);
    expect(result.worth_buying).toBe(true);
  });
});

describe('toFrenchLabel', () => {
  it('maps STOCK_UP to "À acheter en extra"', () => {
    expect(toFrenchLabel('STOCK_UP')).toBe('À acheter en extra');
  });

  it('maps FAKE_SALE to "Faux rabais"', () => {
    expect(toFrenchLabel('FAKE_SALE')).toBe('Faux rabais');
  });

  it('maps WAIT to "Attendre"', () => {
    expect(toFrenchLabel('WAIT')).toBe('Attendre');
  });

  it('maps NOT_ENOUGH_HISTORY to "Pas assez d\'historique"', () => {
    expect(toFrenchLabel('NOT_ENOUGH_HISTORY')).toBe("Pas assez d'historique");
  });

  it('maps MUST_BUY to "Excellent spécial"', () => {
    expect(toFrenchLabel('MUST_BUY')).toBe('Excellent spécial');
  });

  it('maps GREAT_DEAL to "Très bon prix"', () => {
    expect(toFrenchLabel('GREAT_DEAL')).toBe('Très bon prix');
  });

  it('maps GOOD_IF_NEEDED to "Bon prix si tu en as besoin"', () => {
    expect(toFrenchLabel('GOOD_IF_NEEDED')).toBe('Bon prix si tu en as besoin');
  });
});
