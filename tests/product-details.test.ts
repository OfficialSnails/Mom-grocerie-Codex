import { describe, expect, it } from 'vitest';
// @ts-expect-error Shared static browser helper.
import { prepareOfferIds } from '../website/offer-identity.js';
// @ts-expect-error Static browser modules intentionally have no TypeScript build.
import { comparisonRows, relatedOffers, priceComparison, basketSavings, pricePill, createOfferIndex, loyaltyLabel, bestComparableOffer, packageUnitPrice, assessPriceHistory } from '../website/product-details.js';
const offer = (id: string, price: number, format: string | null = 'gr24-each', extra = {}) => ({
  id, name: 'CÉLERI', currentPrice: price, price: `${price.toFixed(2).replace('.', ',')} $`, storeId: id, storeName: id,
  saleStart: '2026-10-01', saleEnd: '2026-10-07',
  offerEvidence: { identity: 'celeri', format, unit: 'each', member: false, ...extra },
});
describe('verified shopping savings', () => {
  it('labels only verified loyalty offers and names the Metro card accurately', () => {
    expect(loyaltyLabel(offer('metro-joliette', .99, 'gr24-each', { member: true }))).toBe('Avec carte Moi');
    expect(loyaltyLabel(offer('metro-montreal', .99, 'gr24-each', { member: true }))).toBe('Avec carte Moi');
    expect(loyaltyLabel(offer('IGA', 1, 'each', { member: true }))).toBe('Avec carte de fidélité');
    expect(loyaltyLabel(offer('Metro', 1))).toBe('');
  });
  it('uses the next lowest matching offer and carries member conditions', () => {
    const item = offer('Metro', .99, 'gr24-each', { member: true });
    expect(priceComparison(item, [offer('IGA', 3), offer('Super C', 2.49)])).toMatchObject({ amount: 1.5, kind: 'store', member: true, canTotal: true });
  });
  it('never subtracts different packages or unconfirmed formats', () => {
    expect(priceComparison(offer('IGA', 2.77, null), [offer('Tradition', 10, '2kg')])).toBeNull();
    expect(priceComparison(offer('IGA', 3.33, '2.5kg'), [offer('Tradition', 11.49, '10kg')])).toBeNull();
  });
  it('does not compare different products, units or non-overlapping dates', () => {
    const current = offer('Metro', 1);
    expect(priceComparison(current, [offer('IGA', 3, 'gr24-each', { identity: 'celeri biologique' })])).toBeNull();
    expect(priceComparison(current, [offer('IGA', 3, 'gr24-each', { unit: 'kg' })])).toBeNull();
    expect(priceComparison(current, [{ ...offer('IGA', 3), saleStart: '2026-10-08' }])).toBeNull();
  });
  it('scopes comparisons to selected stores', () => {
    expect(priceComparison(offer('Metro', 1), [offer('IGA', 3)], new Set(['Metro']))).toBeNull();
  });
  it('uses an explicit regular price without inventing a reference from a percentage', () => {
    expect(priceComparison(offer('Metro', 1, 'each', { regularPrice: 2.99 }))).toMatchObject({ amount: 1.99, kind: 'regular' });
    expect(priceComparison(offer('Metro', 1, null, { advertisedPercent: 50 }))).toBeNull();
  });
  it('keeps variable-unit savings out of the basket sum', () => {
    const item = offer('Metro', 2, 'per:lb', { unit: 'lb', regularPrice: 3 });
    expect(priceComparison(item)).toMatchObject({ amount: 1, unit: '/lb', canTotal: false });
    expect(basketSavings([item], [])).toMatchObject({ amount: 0, count: 0 });
  });
  it('shows the verified squash saving per pound without adding a made-up quantity to the total', () => {
    const squash = offer('Super C', .99, 'per:lb', { identity: 'courges', unit: 'lb', regularPrice: 1.99 });
    const other = offer('Tradition', 1.49, 'per:lb', { identity: 'courges', unit: 'lb' });
    expect(pricePill(squash, [other])).toMatchObject({ label: 'Économisez 0,50 $/lb', saving: { amount: .5, canTotal: false, reference: 1.49 } });
    expect(basketSavings([squash], [other])).toMatchObject({ amount: 0, count: 0 });
  });
  it('counts a verified regular-price saving on an assorted offer without comparing it to another size', () => {
    const oats = offer('Super C', 1.99, null, { identity: 'gruau quaker', unit: 'pack', regularPrice: 3.99 });
    expect(priceComparison(oats, [offer('IGA', 9)])).toMatchObject({ amount: 2, kind: 'regular', canTotal: true });
  });
  it('compares flour at the same quantity and surfaces the winning package', () => {
    const small = offer('IGA', 3.33, '1x2.5kg');
    const large = offer('Tradition', 11.49, '1x10kg');
    expect(pricePill(small, [large])).toMatchObject({ label: '1 autre prix', tone: 'compare' });
    expect(bestComparableOffer(small, [large])).toBe(large);
    expect(priceComparison(large, [small])).toMatchObject({ amount: 1.83, reference: 13.32, referenceQuantity: 4, normalized: true, quantityLabel: '10 kg', canTotal: true });
    expect(basketSavings([large], [small])).toMatchObject({ amount: 1.83 });
    expect(packageUnitPrice(small)).toMatchObject({ amount: 1.332, unit: 'kg' });
    expect(packageUnitPrice(large)?.amount).toBeCloseTo(1.149);
  });
  it('converts mass, volume and multipacks without mixing dimensions or rounding unit rates early', () => {
    expect(priceComparison(offer('A', 3, '1x1kg'), [offer('B', 2, '1x500g')])).toMatchObject({ amount: 1, reference: 4 });
    expect(priceComparison(offer('A', 3, '2x750ml'), [offer('B', 3, '1x1l')])).toMatchObject({ amount: 1.5, reference: 4.5 });
    expect(priceComparison(offer('A', 3, '1x1kg'), [offer('B', 9, '1x1l')])).toBeNull();
    expect(priceComparison(offer('A', 1, 'per:lb', { unit: 'lb' }), [offer('B', 3, 'per:kg', { unit: 'kg' })])).toMatchObject({ amount: .36, unit: '/lb', canTotal: false });
  });
  it('uses proportional quantities, respects selected stores and keeps equal-price stores visible', () => {
    const item = offer('A', 3, '1x750g');
    const other = offer('B', 5, '1x1kg');
    expect(priceComparison(item, [other])).toMatchObject({ amount: .75, referenceQuantity: .75 });
    expect(bestComparableOffer(other, [item], new Set(['B']))).toBe(other);
    expect(bestComparableOffer(item, [offer('C', 4, '1x1kg')])).toBe(item);
    expect(priceComparison(item, [offer('C', 8, '1x1kg', { identity: 'other brand' })])).toBeNull();
  });
  it('counts only the alternative prices shown in the modal, scoped to selected stores', () => {
    const item = offer('IGA', 4.33, null);
    const other = offer('Maxi', 3.99, null);
    const third = offer('Tradition', 4.99, null);
    expect(pricePill(item, [item, other, third])).toMatchObject({ label: '2 autres prix' });
    expect(pricePill(item, [item, other, third], new Set(['IGA', 'Maxi']))).toMatchObject({ label: '1 autre prix' });
    expect(pricePill(item, [item, other], new Set(['IGA']))).toBeNull();
  });
  it('indexes all offers while ignoring unrelated products at the same price', () => {
    const item = { ...offer('Metro', 1), comparisons: ['📊 Gagne contre IGA 3,00 $'] };
    const candidates = createOfferIndex([item, offer('IGA', 3), { ...offer('IGA2', 3), name: 'Shampoing', offerEvidence: { identity: 'shampoing' } }])(item);
    expect(candidates).toHaveLength(2);
  });
});
describe('legacy comparison references', () => {
  it('reads source references without repeating promotional prose', () => {
    expect(comparisonRows({ comparisons: ['📊 Gagne contre Super C 2,49 $/lb', '🏅 Pourquoi ça gagne: 1,50 $ moins cher', '🧾 Autres prix vus: Super C 2,49 $/lb · IGA 3,00 $/lb'] })).toEqual([{ store: 'Super C', price: '2,49 $/lb' }, { store: 'IGA', price: '3,00 $/lb' }]);
  });
});


describe('legacy family ID collisions', () => {
  it('preserves saved IDs and gives distinct prices/formats stable IDs across UI, evidence and PDF', () => {
    const item = { id: 'strawberries', name: 'FRAISES, 1 L', currentPrice: 2.99, unit: 'each' };
    const other = { ...item, name: 'FRAISES PC, 340 G', currentPrice: 6.5 };
    const week = { dealCategories: [{ items: [item] }], allCategories: [{ items: [{ ...item }, other] }] };
    prepareOfferIds(week);
    expect(item.id).toBe('strawberries');
    expect(week.allCategories[0].items[0].id).toBe(item.id);
    expect(other.id).not.toBe(item.id);
    const saved = other.id;
    prepareOfferIds(week);
    expect(other.id).toBe(saved);
    expect(relatedOffers(item, [other])[0].currentPrice).toBe(2.99);
  });
});


describe('data-based price assessment', () => {
  const history = { median: 5, low: 3, weeks: 4, points: [{ date: '2026-08-01', price: 3 }, { date: '2026-08-08', price: 5 }, { date: '2026-08-15', price: 5 }, { date: '2026-08-22', price: 6 }] };
  it('uses comparable prior prices for low, usual and high labels, with the last equal price', () => {
    expect(assessPriceHistory(offer('A', 3, 'each', { history }))).toMatchObject({ label: 'Prix au plus bas', percent: 40, lastSame: { date: '2026-08-01', price: 3 } });
    expect(assessPriceHistory(offer('A', 4, 'each', { history }))).toMatchObject({ label: 'Prix bas', percent: 20 });
    expect(assessPriceHistory(offer('A', 5, 'each', { history }))).toMatchObject({ label: 'Prix habituel' });
    expect(assessPriceHistory(offer('A', 6, 'each', { history }))).toMatchObject({ label: 'Prix élevé' });
  });
  it('does not turn supplier percentages or uncertain historical formats into a recommendation', () => {
    expect(pricePill(offer('A', 3, null, { advertisedPercent: 35 }))).toBeNull();
    const unconfirmed = offer('A', 3, null, { observations: history });
    expect(pricePill(unconfirmed)).toMatchObject({ label: 'Voir les prix', tone: 'compare' });
    expect(assessPriceHistory(unconfirmed)).toBeNull();
    expect(assessPriceHistory(offer('A', 3, 'each', { history: { ...history, weeks: 2 } }))).toBeNull();
  });
});
