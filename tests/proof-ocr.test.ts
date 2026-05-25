import { describe, expect, it } from 'vitest';
import { extractRecoveredOffersFromProofText, inferPackageSizeFromProofText, inferUnitFromProofText } from '../src/proof-ocr.js';

describe('inferUnitFromProofText', () => {
  it('detects per 100g flyer pricing', () => {
    expect(inferUnitFromProofText(3.59, "$/100g 16,28 $/lb Reg. 19,46 $/lb")).toBe('100g');
  });

  it('detects lb pricing from matching kg equivalent', () => {
    expect(inferUnitFromProofText(14.99, '33,05 $/kg Reg. 60,99 $/kg')).toBe('lb');
  });

  it('detects lb pricing when OCR reads lb as Ib', () => {
    expect(inferUnitFromProofText(3.47, 'ASPERGES VERTES Rég. 15,40 $/kg 7,64 $/Ib')).toBe('lb');
  });

  it('detects one-pound packages without treating them as per-pound pricing', () => {
    expect(inferPackageSizeFromProofText('fraises strawberries 1lb')).toEqual({
      size: '454',
      unit: 'g',
      label: 'paquet de 1 lb',
    });
  });

  it('does not guess when the proof text is too weak', () => {
    expect(inferUnitFromProofText(1.39, 'bologne olymel produit en magasin')).toBeNull();
  });
});

describe('extractRecoveredOffersFromProofText', () => {
  it('recovers St-Methode sliced bread rebate offers from flyer proof OCR text', () => {
    const offers = extractRecoveredOffersFromProofText(`
      La récolte de St-Méthode
      pain tranché St-Méthode
      sans gras, sans sucre, 500-675 g, choix varié
      2 50 de rabais à l'achat de 2 pains
    `);

    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      item_name: 'PAIN TRANCHÉ ST-MÉTHODE 500-675 g',
      brand: 'St-Méthode',
      current_price: 2.5,
      source_raw_price: '2,50 $ de rabais',
    });
    expect(offers[0].source_raw_name).toContain("rabais à l'achat de 2 pains");
  });

  it('does not create a recovered offer from generic bread text without a clear rebate', () => {
    const offers = extractRecoveredOffersFromProofText(`
      pain tranché St-Méthode
      voir réduction sur reçu de caisse
    `);

    expect(offers).toEqual([]);
  });
});
