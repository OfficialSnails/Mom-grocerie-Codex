// Display the comparisons already supplied by the weekly export; no rescoring.
export function comparisonRows(item) {
  const rows = [];
  for (const line of item.comparisons ?? []) {
    const plain = line.replace(/^[^\p{L}\p{N}]+/u, '');
    const entries = plain.startsWith('Autres prix vus:')
      ? plain.replace('Autres prix vus:', '').split(' · ')
      : plain.startsWith('Gagne contre ') ? [plain.replace('Gagne contre ', '')] : [];
    for (const entry of entries) {
      const match = entry.trim().match(/^(.+?)\s+(\d[\d.,\s]*\$.*)$/);
      if (!match) continue;
      const [, store, price] = match;
      if (!rows.some(row => row.store === store && row.price === price)) rows.push({ store, price });
    }
  }
  return rows;
}

const rounded = value => Math.round(value * 100) / 100;
const key = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const evidence = item => item.offerEvidence;
const amount = item => Number(item.currentPrice);
const variable = item => /^(lb|kg|100g|l)$/i.test(evidence(item)?.unit ?? '');

export function relatedOffers(item, candidates = [], storeIds) {
  const sameProduct = evidence(item)?.identity ?? key(item.name);
  const refs = comparisonRows(item);
  return [...new Map([item, ...candidates.filter(candidate => {
    if (candidate.id === item.id) return false;
    if (storeIds && !storeIds.has(candidate.storeId)) return false;
    const sameName = (evidence(candidate)?.identity ?? key(candidate.name)) === sameProduct;
    return sameName || refs.some(ref => ref.store === candidate.storeName && ref.price === candidate.price);
  })].map(candidate => [candidate.id, candidate])).values()];
}

// Compare prices at the quantity actually shown on the current offer. A
// package and a per-weight price can share a basis; unknown formats cannot.
const unitBasis = { kg: ['kg', 1], g: ['kg', .001], lb: ['kg', .45359237], '100g': ['kg', .1], l: ['L', 1], ml: ['L', .001], un: ['un.', 1], unite: ['un.', 1], unites: ['un.', 1] };
function quantityBasis(item) {
  const facts = evidence(item);
  if (!facts?.format || !(amount(item) > 0)) return null;
  const per = facts.format.match(/^per:(kg|lb|100g|l)$/i);
  const pack = facts.format.match(/^(\d+)x(\d+(?:\.\d+)?)(kg|g|l|ml|lb|un|unité|unités)$/i);
  if (!per && !pack) return null;
  const rawUnit = key(per ? per[1] : pack[3]);
  const [unit, factor] = unitBasis[rawUnit];
  const size = per ? 1 : Number(pack[1]) * Number(pack[2]);
  if (!(size > 0)) return null;
  return { quantity: size * factor, unit, label: `${new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 3 }).format(size)} ${per ? per[1] : pack[3]}` };
}

export function packageUnitPrice(item) {
  const basis = quantityBasis(item);
  return basis ? { amount: amount(item) / basis.quantity, unit: basis.unit } : null;
}

function equivalentPrice(item, other) {
  const current = evidence(item), facts = evidence(other);
  if (!current?.format || !facts?.format || !current.unit || !facts.unit || current.identity !== facts.identity || !(amount(other) > 0)) return null;
  if ((item.saleStart && other.saleEnd && other.saleEnd < item.saleStart) ||
      (item.saleEnd && other.saleStart && other.saleStart > item.saleEnd)) return null;
  const basis = quantityBasis(item), reference = quantityBasis(other);
  if (basis && reference && basis.unit === reference.unit) return amount(other) * basis.quantity / reference.quantity;
  return current.format === facts.format && current.unit === facts.unit ? amount(other) : null;
}

export function comparableOffers(item, candidates = [], storeIds) {
  return relatedOffers(item, candidates, storeIds).filter(other => equivalentPrice(item, other) !== null)
    .sort((a, b) => equivalentPrice(item, a) - equivalentPrice(item, b));
}

export function bestComparableOffer(item, candidates = [], storeIds) {
  const best = comparableOffers(item, candidates, storeIds)[0];
  // Keep both store offers on ties, and never silently alter a saved selection.
  return best && equivalentPrice(item, best) < amount(item) - .005 ? best : item;
}

// Fixed-package savings are per purchased package, even when the reference
// uses another size. Weight savings stay per displayed unit until a weight is known.
export function priceComparison(item, candidates = [], storeIds) {
  const facts = evidence(item);
  const current = amount(item);
  if (!facts || !(current > 0)) return null;
  const others = comparableOffers(item, candidates, storeIds).filter(other => other.storeId !== item.storeId);
  const next = others[0];
  const reference = next ? equivalentPrice(item, next) : null;
  const unit = variable(item) ? `/${facts.unit}` : '';
  if (reference > current + .005) {
    const basis = quantityBasis(item), otherBasis = quantityBasis(next);
    const normalized = facts.format !== evidence(next).format;
    return {
      amount: rounded(reference - current), unit, store: next.storeName,
      reference: rounded(reference), referenceItem: next, kind: 'store',
      member: facts.member || evidence(next)?.member || false, canTotal: !unit,
      normalized, quantityLabel: normalized ? basis.label : '',
      referencePrice: amount(next), referenceFormat: evidence(next).formatLabel || (variable(next) ? `Prix par ${evidence(next).unit}` : evidence(next).format.replace(/^1x/, '')),
      referenceQuantity: normalized ? basis.quantity / otherBasis.quantity : 1,
      currentRate: normalized ? packageUnitPrice(item) : null,
      referenceRate: normalized ? packageUnitPrice(next) : null,
    };
  }
  if (facts.regularPrice > current) return {
    amount: rounded(facts.regularPrice - current), unit, store: item.storeName,
    reference: facts.regularPrice, kind: 'regular', member: facts.member, canTotal: !unit,
  };
  return null;
}

export function comparisonBasisLabel(saving) {
  return saving.normalized ? `Pour ${saving.quantityLabel}` : '';
}

export function basketSavings(items, candidates, storeIds) {
  const { entries, ...summary } = basketSavingsDetails(items, candidates, storeIds);
  return summary;
}

export function basketSavingsDetails(items, candidates, storeIds) {
  const entries = items.map(item => {
    const saving = priceComparison(item, candidates, storeIds);
    return { id: item.id, saving };
  });
  const savings = entries.map(entry => entry.saving).filter(saving => saving?.canTotal);
  return { amount: rounded(savings.reduce((sum, saving) => sum + saving.amount, 0)), count: savings.length,
    member: savings.some(saving => saving.member), compared: savings.filter(s => s.kind === 'store').length,
    regular: savings.filter(s => s.kind === 'regular').length, entries };
}

export function pricePill(item, candidates, storeIds) {
  const saving = priceComparison(item, candidates, storeIds);
  const offers = relatedOffers(item, candidates, storeIds);
  if (saving) return { saving, offers, tone: 'saving', label: `Économisez ${money(saving.amount)}${saving.unit}` };
  const alternativeCount = offers.filter(offer => offer.id !== item.id).length;
  if (alternativeCount && offers.some(offer => offer.storeId !== item.storeId) && offers.every(offer => Math.abs(amount(offer) - amount(item)) < .005)) {
    return { offers, tone: 'compare', label: 'Même prix ailleurs' };
  }
  if (alternativeCount) return { offers, tone: 'compare', label: `${alternativeCount} autre${alternativeCount > 1 ? 's' : ''} prix` };
  const assessment = assessPriceHistory(item);
  if (assessment) return { offers, tone: assessment.tone, label: assessment.label, history: true };
  if (item.offerEvidence?.observations?.points?.length) return { offers, tone: 'compare', label: 'Voir les prix', history: true };
  return null;
}
export function money(value) { return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(value); }
export function loyaltyLabel(item) {
  if (!item.offerEvidence?.member) return '';
  return /^metro(?:-|$)/i.test(item.storeId) ? 'Avec carte Moi' : 'Avec carte de fidélité';
}
export function productTitle(name) {
  if (name !== name.toLocaleUpperCase('fr-CA')) return name;
  const text = name.toLocaleLowerCase('fr-CA').replace(/\b(pc|bbq)\b/g, value => value.toUpperCase());
  return text.charAt(0).toLocaleUpperCase('fr-CA') + text.slice(1);
}

const productCollator = new Intl.Collator('fr-CA', { sensitivity: 'base', numeric: true, ignorePunctuation: true });
const sortText = value => String(value ?? '').trim().replace(/\s+/g, ' ');
// Catalogue order is independent of the export's deal ranking and store order.
// Sort a copy so offer IDs, source snapshots and saved selections stay intact.
export function sortProducts(items) {
  return [...items].sort((a, b) => productCollator.compare(sortText(a.name), sortText(b.name))
    || productCollator.compare(sortText(a.storeName), sortText(b.storeName))
    || productCollator.compare(String(a.id ?? ''), String(b.id ?? '')));
}

export function createOfferIndex(items) {
  const names = new Map(), prices = new Map();
  for (const item of items) {
    const name = item.offerEvidence?.identity ?? key(item.name);
    if (!names.has(name)) names.set(name, []);
    names.get(name).push(item);
    const price = `${item.storeName}|${item.price}`;
    if (!prices.has(price)) prices.set(price, []);
    prices.get(price).push(item);
  }
  return item => [...new Map([...(names.get(item.offerEvidence?.identity ?? key(item.name)) ?? []),
    ...comparisonRows(item).flatMap(row => prices.get(`${row.store}|${row.price}`) ?? [])]
    .filter(candidate => candidate.id === item.id || key(candidate.name) === key(item.name) ||
      // Existing cross-store references can include other sizes. Keep them visible in the modal, never silently equivalent.
      (item.comparisons?.length && key(candidate.name).split(' ').filter(word => word.length > 3 && key(item.name).includes(word)).length >= 2))
    .map(candidate => [candidate.id, candidate])).values()];
}

// Recommendations use only comparable earlier weeks, not supplier percentages.
export function assessPriceHistory(item) {
  const history = item.offerEvidence?.history;
  if (!history || history.weeks < 3 || !(history.median > 0)) return null;
  const ratio = amount(item) / history.median;
  const label = (amount(item) < history.low - .005 || (amount(item) <= history.low + .005 && history.low < history.median)) ? 'Prix au plus bas' : ratio < .9 ? 'Prix bas' : ratio > 1.1 ? 'Prix élevé' : 'Prix habituel';
  return { label, tone: ratio < .9 || amount(item) <= history.low + .005 ? 'saving' : 'compare',
    median: history.median, low: history.low, percent: Math.round(Math.abs(1 - ratio) * 100), below: ratio < 1,
    previous: history.points?.at(-1), lastSame: history.points?.filter(point => Math.abs(point.price - amount(item)) < .005).at(-1) };
}
