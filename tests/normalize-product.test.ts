import { describe, it, expect } from 'vitest';
import {
  removeAccents,
  normalizeString,
  cleanItemName,
  findMatchingProduct,
  type Product,
} from '../src/normalize-product.js';

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'beurre',
    normalized_name: 'beurre',
    display_name: 'Beurre',
    category: 'produits-laitiers',
    synonyms: ['butter', 'beurre lactantia', 'lactantia butter', 'beurre armstrong'],
    unit_type: 'each',
    is_stock_up_friendly: true,
  },
  {
    id: 'fromage-cheddar',
    normalized_name: 'fromage cheddar',
    display_name: 'Fromage cheddar',
    category: 'produits-laitiers',
    synonyms: ['cheddar cheese', 'fromage cheddar fort', 'old cheddar', 'cheddar block'],
    unit_type: 'kg',
    is_stock_up_friendly: true,
  },
  {
    id: 'raisins',
    normalized_name: 'raisins',
    display_name: 'Raisins',
    category: 'fruits',
    synonyms: ['grapes', 'raisins rouges', 'raisins verts', 'red grapes', 'green grapes', 'raisins sans pepins', 'seedless grapes'],
    unit_type: 'kg',
    is_stock_up_friendly: false,
  },
  {
    id: 'poitrine-poulet',
    normalized_name: 'poitrine de poulet',
    display_name: 'Poitrine de poulet',
    category: 'viande',
    synonyms: ['chicken breast', 'filet de poulet', 'chicken filet'],
    unit_type: 'kg',
    is_stock_up_friendly: true,
  },
];

describe('removeAccents', () => {
  it('removes é accent', () => {
    expect(removeAccents('légumes')).toBe('legumes');
  });

  it('removes multiple accents', () => {
    expect(removeAccents('côtelettes')).toBe('cotelettes');
  });

  it('leaves plain ASCII unchanged', () => {
    expect(removeAccents('butter')).toBe('butter');
  });
});

describe('normalizeString', () => {
  it('lowercases and removes accents', () => {
    expect(normalizeString('Poitrine de Poulet')).toBe('poitrine de poulet');
  });

  it('trims whitespace', () => {
    expect(normalizeString('  beurre  ')).toBe('beurre');
  });
});

describe('cleanItemName', () => {
  it('removes size tokens', () => {
    const result = cleanItemName('Beurre Lactantia 454g');
    expect(result).not.toContain('454g');
  });

  it('removes "club size" qualifier', () => {
    const result = cleanItemName('Chicken breast club size');
    expect(result.toLowerCase()).not.toContain('club size');
  });

  it('removes "selected varieties"', () => {
    const result = cleanItemName('Fromage cheddar selected varieties 400g');
    expect(result.toLowerCase()).not.toContain('selected varieties');
  });
});

describe('findMatchingProduct', () => {
  it('matches French butter to beurre product', () => {
    const match = findMatchingProduct('Beurre Lactantia 454g', SAMPLE_PRODUCTS);
    expect(match?.id).toBe('beurre');
  });

  it('matches English "butter" to beurre product', () => {
    const match = findMatchingProduct('Lactantia Butter 454g', SAMPLE_PRODUCTS);
    expect(match?.id).toBe('beurre');
  });

  it('matches "Fromage cheddar fort 400g" to cheddar', () => {
    const match = findMatchingProduct('Fromage cheddar fort 400g', SAMPLE_PRODUCTS);
    expect(match?.id).toBe('fromage-cheddar');
  });

  it('matches "cheddar cheese block" to cheddar', () => {
    const match = findMatchingProduct('Cheddar cheese block 400g', SAMPLE_PRODUCTS);
    expect(match?.id).toBe('fromage-cheddar');
  });

  it('matches "raisins rouges sans pépins" to raisins', () => {
    const match = findMatchingProduct('Raisins rouges sans pépins 1kg', SAMPLE_PRODUCTS);
    expect(match?.id).toBe('raisins');
  });

  it('matches "grapes red seedless" to raisins', () => {
    const match = findMatchingProduct('Grapes red seedless', SAMPLE_PRODUCTS);
    expect(match?.id).toBe('raisins');
  });

  it('matches "Poitrine de poulet sans os" to chicken', () => {
    const match = findMatchingProduct('Poitrine de poulet sans os', SAMPLE_PRODUCTS);
    expect(match?.id).toBe('poitrine-poulet');
  });

  it('matches "chicken breast" to chicken', () => {
    const match = findMatchingProduct('Chicken breast boneless', SAMPLE_PRODUCTS);
    expect(match?.id).toBe('poitrine-poulet');
  });

  it('returns null for unrecognized item', () => {
    const match = findMatchingProduct('Cornichons marinés 500ml', SAMPLE_PRODUCTS);
    expect(match).toBeNull();
  });
});
