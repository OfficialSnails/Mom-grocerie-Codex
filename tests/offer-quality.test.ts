import { describe, expect, it } from 'vitest';
import { classifyShopperCategory, findSuspiciousCategoryItems, type ScoredDeal } from '../src/generate-report.js';
import { expandedProofCrop } from '../src/proof-crop.js';
import { regroupCategories } from '../src/refresh-offer-quality.js';
import { evidenceFor } from '../src/offer-evidence.js';
import { estimateBasketTotal } from '../src/price-estimate.js';
// @ts-expect-error Shared static website helpers.
import { prepareOfferIds, applyOfferEvidence } from '../website/offer-identity.js';
// @ts-expect-error Shared static website helpers.
import { relatedOffers, priceComparison, pricePill } from '../website/product-details.js';

const source = (name: string, extra = {}): ScoredDeal => ({ item_name: name, store_id: 'iga-joliette', store_name: 'IGA',
  current_price: 4.98, confidence: 'HIGH', score: 0, label: '', french_label: '', french_reason: '', worth_buying: false, ...extra });
describe('product category precision', () => {
  it.each([
    ['Pâte à biscuits Pillsbury', 'bakery'], ['Croûtes à tarte Pillsbury', 'bakery'], ['Pizza Pops Pillsbury', 'frozen'],
    ['Pastilles Finish pour lave-vaisselle', 'household'], ['Pastilles de chocolat Chocolats Favoris', 'pantry'],
    ['Pastilles pour la gorge', 'health'], ['Sleeping pills', 'health'], ['Piles Duracell Power Boost', 'household'], ['Boost substitut de repas', 'health'],
    ['Beurre d’arachides Kraft', 'pantry'], ['Beurre Lactantia', 'dairy-eggs'], ['Crème de coco Haiku', 'pantry'],
    ['Macaroni et fromage KD', 'pantry'], ['Croissants 100 % beurre', 'bakery'], ['Yogourt glacé', 'frozen'],
    ['Lait corporel Nivea', 'health'], ['Crème de nuit Nivea', 'health'], ['Excellence crème colorante', 'health'],
    ['Crème pour dentiers Poligrip', 'health'], ['Dentifrice Sensodyne', 'health'], ['Lait Natrel', 'dairy-eggs'],
    ['Ailes de canard', 'meat-fish'], ['Ail du Québec', 'produce'], ['Biscuits Digestive', 'snacks-drinks'],
    ['Cépacol pastilles miel et citron', 'health'], ['Nicorette pastilles', 'health'], ['Médaillons de pétoncles', 'meat-fish'],
    ['Serviettes menstruelles Always', 'household'], ['Pois chiches', 'pantry'], ['Légumineuses Selection', 'pantry'],
    ['Pâte réfrigérée Pillsbury pour biscuits', 'bakery'], ['Formule probiotique Garden of Life', 'health'],
    ['Yogourt probiotique Activia', 'dairy-eggs'], ['Friandise au beurre d’arachide', 'snacks-drinks'],
  ])('%s → %s', (name, category) => expect(classifyShopperCategory(source(name))).toBe(category));
  it('retains explicit frozen source context', () => {
    expect(classifyShopperCategory(source('Ailes de canard', { source_raw_name: 'Ailes de canard | Frozen duck wings' }))).toBe('frozen');
  });
  it('flags ingredient/brand false positives in every section', () => {
    const findings = findSuspiciousCategoryItems([{ id: 'health', items: [{ name: 'Pâte à biscuits Pillsbury' }] },
      { id: 'dairy-eggs', items: [{ name: 'Crème de nuit Nivea' }] }]);
    expect(findings.map(f => f.suggestedCategory)).toEqual(['bakery', 'health']);
  });
});

describe('source-backed photo bounds', () => {
  const flyer = { imageBase: 'https://f.wishabi.net/flyers/abc-123/', height: 2000, level: 4, tileSpan: 500,
    pages: [{ left: 0, right: 2000, top: 0, bottom: -2000 }] };
  const text = { left: 0, right: 250, top: -700, bottom: -1200 };
  const item = { left: 250, right: 395, top: -450, bottom: -1000, price: '2.7', text_areas: [text] };
  it('uses the shared offer instead of a sliver, within the source page', () => {
    const other = { left: 395, right: 690, top: -820, bottom: -1220, price: '2.7', text_areas: [text] };
    const crop = expandedProofCrop(item, [item, other], flyer)!;
    expect(crop.left).toBe(0); expect(crop.right).toBeGreaterThanOrEqual(690);
    expect(crop.top).toBeGreaterThanOrEqual(item.top); expect(crop.bottom).toBeLessThanOrEqual(-1220);
  });
  it('does not include adjacent offers with different prices or unrelated text', () => {
    const other = { left: 395, right: 690, top: -820, bottom: -1220, price: '9.99', text_areas: [text] };
    expect(expandedProofCrop(item, [item, other], flyer)!.right).toBeLessThan(420);
    expect(expandedProofCrop({ ...item, text_areas: [{ left: 1400, right: 1900, top: 0, bottom: -1900 }] }, [], flyer)).toBeUndefined();
  });
  it('keeps good cutouts and leaves missing/invalid geometry untouched', () => {
    expect(expandedProofCrop({ ...item, right: 700 }, [], flyer)).toBeUndefined();
    expect(expandedProofCrop({ price: '2.7' }, [], flyer)).toBeUndefined();
    expect(expandedProofCrop({ ...item, text_areas: [] }, [], flyer)).toBeUndefined();
  });
});

describe('offer preservation and units', () => {
  const offer = (id: string) => ({ id, name: 'Bleuets', storeId: id, currentPrice: 4.99, price: '4,99 $',
    offerEvidence: { identity: 'bleuets', unit: 'each', format: '1x170g' } });
  it('keeps same-price stores available without claiming cross-store savings', () => {
    const a = offer('IGA'), b = offer('Tradition');
    expect(relatedOffers(a, [a, b])).toHaveLength(2);
    expect(priceComparison(a, [a, b])).toBeNull();
    expect(pricePill(a, [a, b])).toMatchObject({ tone: 'compare', label: 'Même prix ailleurs' });
  });
  it('preserves existing selected IDs when category order changes', () => {
    const a = { ...offer('same-family'), name: 'Crème', unit: null }, b = { ...offer('same-family'), name: 'Crème de nuit', unit: null };
    const week = prepareOfferIds({ allCategories: [{ id: 'dairy-eggs', title: 'Produits laitiers', items: [a, b] }] });
    const saved = [a.id, b.id];
    week.allCategories = regroupCategories(week.allCategories, i => source(i.name));
    week.allCategories.reverse(); prepareOfferIds(week);
    expect(week.allCategories.flatMap((c: any) => c.items.map((i: any) => i.id)).sort()).toEqual(saved.sort());
  });
  it('keeps the fetched bundle amount and excludes verified weight prices from fixed totals', () => {
    const bundle = { ...offer('BoniChoix'), currentPrice: 4.98 };
    applyOfferEvidence(bundle, evidenceFor(source('Brocoli'), { currentPrice: 4.98, unit: 'pack', quantity: 2, format: '2x1each', note: 'Photo' }));
    expect(bundle).toMatchObject({ currentPrice: 4.98, price: '2 pour 4,98 $' });
    const weighted = { ...offer('Metro'), currentPrice: .99 };
    applyOfferEvidence(weighted, evidenceFor(source('Chou', { current_price: .99 }), { currentPrice: .99, unit: 'lb', format: 'per:lb', note: 'Photo' }));
    expect(weighted).toMatchObject({ currentPrice: .99, price: '0,99 $/lb' });
    expect(estimateBasketTotal([bundle, weighted])).toMatchObject({ subtotal: 4.98, variableCount: 1 });
  });
  it('applies a reviewed photo correction only to the matching feed amount', () => {
    const facts = { currentPrice: 2.7, verifiedPrice: 2.77, unit: 'pack', format: '1x908g', note: 'Printed flyer price' };
    const item = { ...offer('IGA'), currentPrice: 2.7 };
    applyOfferEvidence(item, evidenceFor(source('Clémentines', { current_price: 2.7 }), facts));
    expect(item).toMatchObject({ currentPrice: 2.77, fetchedPrice: 2.7, price: '2,77 $' });
    const changed = { ...offer('IGA'), currentPrice: 3 };
    applyOfferEvidence(changed, evidenceFor(source('Clémentines', { current_price: 3 }), facts));
    expect(changed.currentPrice).toBe(3);
  });
});
