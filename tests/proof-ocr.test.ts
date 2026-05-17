import { describe, expect, it } from 'vitest';
import { inferPackageSizeFromProofText, inferUnitFromProofText } from '../src/proof-ocr.js';

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
