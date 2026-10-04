import { loyaltyLabel } from './product-details.js';

export const SAVED_LISTS_KEY = 'bons-speciaux:saved-lists:v1';
const clone = value => JSON.parse(JSON.stringify(value));
const sum = values => Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
const validAmount = value => Number.isFinite(value) && value >= 0;

// Freeze the prices, comparison references and chosen addresses, not the live catalogue.
export function createListSnapshot({ week, regionId, stores, estimate, savings, notes }, now = new Date()) {
  const entries = savings.entries.map(({ id, saving, difference }) => ({ id, difference: difference ? {
    amount: difference.amount, reference: difference.reference, store: difference.store,
    currentFormat: difference.currentFormat, referenceFormat: difference.referenceFormat,
    currentUnitPrice: difference.currentUnitPrice, referenceUnitPrice: difference.referenceUnitPrice,
  } : null, saving: saving ? {
    amount: saving.amount, reference: saving.reference, unit: saving.unit,
    kind: saving.kind, store: saving.store, canTotal: saving.canTotal,
    normalized: saving.normalized, quantityLabel: saving.quantityLabel,
    referencePrice: saving.referencePrice, referenceFormat: saving.referenceFormat,
    referenceQuantity: saving.referenceQuantity, currentRate: saving.currentRate, referenceRate: saving.referenceRate,
    referenceCondition: saving.referenceItem ? loyaltyLabel(saving.referenceItem) : '',
  } : null }));
  return clone({
    id: `${regionId}:${week.slug}`, regionId, savedAt: now.toISOString(),
    week: { slug: week.slug, title: week.title, weekRange: week.weekRange, regionName: week.regionName },
    notes, estimate, savings: { ...savings, entries },
    stores: stores.map(store => ({
      id: store.id, name: store.name, address: store.address, estimate: store.estimate,
      branch: store.branch ? { id: store.branch.id, chainId: store.branch.chainId, name: store.branch.name,
        street: store.branch.street, city: store.branch.city, postalCode: store.branch.postalCode,
        lat: store.branch.lat, lon: store.branch.lon } : undefined,
      items: store.items.map(item => ({
        id: item.id, name: item.name, price: item.price, currentPrice: item.currentPrice, unit: item.unit,
        storeId: item.storeId, storeName: item.storeName,
        offerEvidence: item.offerEvidence ? {
          formatLabel: item.offerEvidence.formatLabel, member: item.offerEvidence.member,
        } : undefined,
      })),
    })),
  });
}

export function validSnapshot(list) {
  if (list?.archivedAt !== undefined && (typeof list.archivedAt !== 'string' || !Number.isFinite(Date.parse(list.archivedAt)))) return false;
  if (!list || typeof list.regionId !== 'string' || typeof list.week?.slug !== 'string' ||
      list.id !== `${list.regionId}:${list.week.slug}` || !Number.isFinite(Date.parse(list.savedAt)) ||
      typeof list.notes !== 'string' || !validAmount(list.estimate?.subtotal) ||
      !validAmount(list.savings?.amount) || !Array.isArray(list.savings.entries) ||
      !Array.isArray(list.stores) || !list.stores.length) return false;
  if (!list.stores.every(store => typeof store.name === 'string' && validAmount(store.estimate?.subtotal) &&
      Array.isArray(store.items) && store.items.length && store.items.every(item =>
        typeof item.id === 'string' && typeof item.name === 'string' && typeof item.price === 'string'))) return false;
  const ids = list.stores.flatMap(store => store.items.map(item => item.id));
  if (new Set(ids).size !== ids.length || list.savings.entries.length !== ids.length) return false;
  if (new Set(list.savings.entries.map(entry => entry.id)).size !== ids.length) return false;
  if (list.savings.entries.some(entry => entry.difference && (!validAmount(entry.difference.amount) ||
      !validAmount(entry.difference.reference) || typeof entry.difference.store !== 'string'))) return false;
  if (!list.savings.entries.every(entry => ids.includes(entry.id) && (entry.saving === null || (
    validAmount(entry.saving?.amount) && validAmount(entry.saving.reference) &&
    typeof entry.saving.store === 'string' && typeof entry.saving.unit === 'string' &&
    typeof entry.saving.canTotal === 'boolean' && ['store', 'regular'].includes(entry.saving.kind)
  )))) return false;
  const included = list.savings.entries.filter(entry => entry.saving?.canTotal);
  return list.savings.amount === sum(included.map(entry => entry.saving.amount)) &&
    list.savings.count === included.length;
}

export function readSavedLists(storage) {
  let raw;
  try { raw = storage.getItem(SAVED_LISTS_KEY); }
  catch { throw new Error('Le navigateur bloque l’accès aux listes enregistrées.'); }
  if (raw === null) return [];
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error('Les listes enregistrées sont illisibles. Elles ont été conservées.'); }
  if (data?.version !== 1 || !Array.isArray(data.lists) || !data.lists.every(validSnapshot) ||
      new Set(data.lists.map(list => list.id)).size !== data.lists.length) {
    throw new Error('Le format des listes enregistrées est invalide. Elles ont été conservées.');
  }
  return data.lists.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

function writeLists(storage, lists) {
  try { storage.setItem(SAVED_LISTS_KEY, JSON.stringify({ version: 1, lists })); }
  catch { throw new Error('Enregistrement impossible. Vérifie l’espace disponible et les réglages du navigateur.'); }
}

export function saveList(storage, snapshot) {
  if (!validSnapshot(snapshot)) throw new Error('Cette liste ne peut pas être enregistrée.');
  // A repeat save updates this region/week instead of double-counting its savings.
  const lists = readSavedLists(storage).filter(list => list.id !== snapshot.id);
  lists.unshift(clone(snapshot));
  writeLists(storage, lists);
  return lists;
}

export function removeSavedList(storage, id) {
  const lists = readSavedLists(storage).filter(list => list.id !== id);
  writeLists(storage, lists);
  return lists;
}

export function setListArchived(storage, id, archived, now = new Date()) {
  const lists = readSavedLists(storage);
  const list = lists.find(snapshot => snapshot.id === id);
  if (!list) throw new Error('Cette liste n’est plus disponible.');
  if (archived) list.archivedAt = now.toISOString();
  else delete list.archivedAt;
  writeLists(storage, lists);
  return list;
}

export function savedListTotals(lists) {
  return {
    savings: sum(lists.map(list => list.savings.amount)),
    subtotal: sum(lists.map(list => list.estimate.subtotal)),
    count: lists.length,
  };
}
