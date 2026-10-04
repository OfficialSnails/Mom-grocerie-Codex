import { describe, expect, it } from 'vitest';
// @ts-expect-error Static browser modules intentionally have no TypeScript build.
import { createListSnapshot, readSavedLists, saveList, removeSavedList, setListArchived, savedListTotals, changeListBranch, relocateList, SAVED_LISTS_KEY } from '../website/saved-lists.js';
// @ts-expect-error Shared with the static website and local PDF server.
import { basketSavings, basketSavingsDetails } from '../website/product-details.js';

const item = (id: string, price: number, extra = {}) => ({
  id, name: 'Céleri', storeId: id, storeName: id, currentPrice: price, price: `${price} $`,
  offerEvidence: { identity: 'celeri', format: 'gr24', unit: 'each', member: false, ...extra },
});
const storage = () => {
  const values = new Map();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
};
function context(regionId = 'joliette', slug = '2026-10-01') {
  const selected = item('metro', .99, { member: true });
  const estimate = { subtotal: .99, fixedCount: 1, variableCount: 0, unknownCount: 0, totalCount: 1 };
  return { regionId, week: { slug, weekRange: '1 au 7 octobre 2026', title: 'Liste d’épicerie', regionName: regionId },
    stores: [{ id: 'metro', name: 'Metro', address: '180 rue Beaudry Nord', items: [selected], estimate }],
    notes: 'Un céleri', estimate, savings: basketSavingsDetails([selected], [item('Super C', 2.49)]),
  };
}

describe('saved-list destinations', () => {
  // Simulated coordinates isolate destination changes from the weekly catalogue.
  const origin = { lat: 46, lon: -73 };
  const directory = { regionCenters: { joliette: origin }, branches: [
    { id: 'metro-near', chainId: 'metro', name: 'Metro', street: '1 Rue A', city: 'Ville A', postalCode: 'J0K 1A0', ...origin },
    { id: 'metro-other', chainId: 'metro', name: 'Metro', street: '2 Rue B', city: 'Ville B', lat: 46.1, lon: -73 },
    { id: 'metro-far', chainId: 'metro', name: 'Metro', street: '3 Rue C', city: 'Ville C', lat: 48, lon: -73 },
    { id: 'maxi-near', chainId: 'maxi', name: 'Maxi', street: '4 Rue D', city: 'Ville A', ...origin },
  ] };
  it('saves an explicit branch without altering frozen products, notes, prices or archive state', () => {
    const local = storage();
    const original = { ...createListSnapshot(context(), new Date('2026-10-03T20:00:00Z')), archivedAt: '2026-10-04T10:00:00Z' };
    const changed = changeListBranch(original, 'metro', 'metro-other', directory, origin);
    expect(changed.stores[0].address).toBe('2 Rue B, Ville B');
    expect(changed.stores[0].branch.id).toBe('metro-other');
    expect({ ...changed, stores: original.stores }).toEqual(original);
    expect({ ...changed.stores[0], address: original.stores[0].address, branch: undefined }).toEqual(original.stores[0]);
    expect(original.stores[0].address).toBe('180 rue Beaudry Nord');
    saveList(local, changed);
    expect(readSavedLists(local)).toEqual([JSON.parse(JSON.stringify(changed))]);
  });
  it('rejects another chain, unknown branch/store and branches outside the selected area', () => {
    const original = createListSnapshot(context());
    for (const id of ['maxi-near', 'missing', 'metro-far']) {
      expect(() => changeListBranch(original, 'metro', id, directory, origin)).toThrow('pas disponible');
    }
    expect(() => changeListBranch(original, 'unknown', null, directory, origin)).toThrow('introuvable');
  });
  it('uses the new origin for every store and keeps the saved flyer region and prices', () => {
    const original = createListSnapshot(context());
    original.stores.push({ ...original.stores[0], id: 'maxi', name: 'Maxi' });
    const relocated = relocateList(original, directory, { lat: 46.1, lon: -73 });
    expect(relocated.stores.map((store: any) => store.branch.id)).toEqual(['metro-other', 'maxi-near']);
    expect(relocated.regionId).toBe(original.regionId);
    expect(relocated.week).toEqual(original.week);
    expect(relocated.estimate).toEqual(original.estimate);
    expect(relocated.stores.map((store: any) => store.items)).toEqual(original.stores.map((store: any) => store.items));
    const changed = changeListBranch(relocated, 'metro', 'metro-near', directory, origin);
    expect(changed.stores[1]).toEqual(relocated.stores[1]);
  });
  it('clears a stale destination when no branch is available and rejects invalid origins', () => {
    const original = createListSnapshot(context());
    const relocated = relocateList(original, directory, { lat: 49, lon: -73 });
    expect(relocated.stores[0].address).toBe('');
    expect(relocated.stores[0].branch).toBeUndefined();
    expect(relocated.stores[0].items).toEqual(original.stores[0].items);
    for (const point of [null, {}, { lat: NaN, lon: -73 }, { lat: 100, lon: 0 }]) {
      expect(() => relocateList(original, directory, point)).toThrow('invalide');
    }
  });
  it('keeps sourced locality metadata for branches whose street is unknown', () => {
    const branches = [{ id: 'partial', chainId: 'metro', name: 'Metro', ...origin, nearbyPlace: { name: 'Ville A', distanceKm: 1 } }];
    const changed = changeListBranch(createListSnapshot(context()), 'metro', 'partial', { ...directory, branches }, origin);
    expect(changed.stores[0].address).toBe('');
    expect(changed.stores[0].branch.nearbyPlace.name).toBe('Ville A');
  });
});

describe('savings breakdown', () => {
  it('uses exactly the same sum as the basket, keeping per-weight savings separate', () => {
    const items = [item('Metro', .99), item('Bananas', 1, { identity: 'bananes', format: 'per:lb', unit: 'lb', regularPrice: 2 }), item('Unknown', 2, { format: null })];
    const candidates = [item('Super C', 2.49)];
    const detail = basketSavingsDetails(items, candidates);
    const { entries, ...summary } = detail;
    expect(summary).toEqual(basketSavings(items, candidates));
    expect(detail).toMatchObject({ amount: 1.5, count: 1 });
    expect(entries[1].saving).toMatchObject({ amount: 1, unit: '/lb', canTotal: false });
    expect(entries[2].saving).toBeNull();
  });
});

describe('saved weekly lists', () => {
  it('archives and restores a complete snapshot without changing prices, savings or save date', () => {
    const local = storage();
    const original = createListSnapshot(context(), new Date('2026-10-03T20:00:00Z'));
    saveList(local, original);
    const archived = setListArchived(local, original.id, true, new Date('2026-10-03T21:00:00Z'));
    expect(archived).toEqual({ ...original, archivedAt: '2026-10-03T21:00:00.000Z' });
    expect(readSavedLists(local).filter((list: { archivedAt?: string }) => !list.archivedAt)).toHaveLength(0);
    expect(savedListTotals(readSavedLists(local))).toMatchObject({ savings: 1.5, count: 1 });
    setListArchived(local, original.id, false);
    expect(readSavedLists(local)).toEqual([original]);
  });
  it('keeps archive changes scoped to the chosen list and reports missing lists', () => {
    const local = storage();
    const first = createListSnapshot(context());
    const second = createListSnapshot(context('montreal'));
    saveList(local, first);
    saveList(local, second);
    setListArchived(local, first.id, true);
    expect(readSavedLists(local).find((list: { id: string }) => list.id === second.id)).toEqual(second);
    expect(() => setListArchived(local, 'missing', true)).toThrow('plus disponible');
    removeSavedList(local, first.id);
    expect(readSavedLists(local)).toEqual([second]);
  });
  it('a new save for an archived region/week replaces it in the active lists without duplicates', () => {
    const local = storage();
    const snapshot = createListSnapshot(context());
    saveList(local, snapshot);
    setListArchived(local, snapshot.id, true);
    saveList(local, snapshot);
    expect(readSavedLists(local)).toEqual([snapshot]);
  });
  it('freezes product prices, references, addresses and notes independently of the active basket', () => {
    const current = context();
    const snapshot = createListSnapshot(current, new Date('2026-10-03T20:00:00Z'));
    current.stores[0].items[0].price = '9,99 $';
    current.stores[0].address = 'Changed';
    current.savings.entries[0].saving.referenceItem.currentPrice = 99;
    current.notes = 'Changed';
    expect(snapshot.stores[0].items[0].price).toBe('0.99 $');
    expect(snapshot.stores[0].address).toBe('180 rue Beaudry Nord');
    expect(snapshot.savings.entries[0].saving.reference).toBe(2.49);
    expect(snapshot.notes).toBe('Un céleri');
    expect(snapshot.savedAt).toBe('2026-10-03T20:00:00.000Z');
  });
  it('updates the same region/week without multiplying savings, and preserves other weeks and regions', () => {
    const local = storage();
    saveList(local, createListSnapshot(context()));
    saveList(local, createListSnapshot(context()));
    expect(readSavedLists(local)).toHaveLength(1);
    expect(savedListTotals(readSavedLists(local))).toMatchObject({ savings: 1.5, count: 1 });
    saveList(local, createListSnapshot(context('montreal')));
    saveList(local, createListSnapshot(context('joliette', '2026-10-08')));
    expect(savedListTotals(readSavedLists(local))).toMatchObject({ savings: 4.5, count: 3 });
    removeSavedList(local, 'montreal:2026-10-01');
    expect(readSavedLists(local).map((list: { id: string }) => list.id)).not.toContain('montreal:2026-10-01');
    expect(readSavedLists(local)).toHaveLength(2);
  });
  it('re-reads storage before writing so sequential saves from two views do not lose other lists', () => {
    const local = storage();
    readSavedLists(local);
    saveList(local, createListSnapshot(context('montreal')));
    saveList(local, createListSnapshot(context('joliette')));
    expect(readSavedLists(local)).toHaveLength(2);
  });
  it('surfaces blocked reads and quota failures instead of reporting a successful save', () => {
    expect(() => readSavedLists({ getItem: () => { throw new Error(); } })).toThrow('bloque');
    expect(() => saveList({ getItem: () => null, setItem: () => { throw new Error(); } }, createListSnapshot(context()))).toThrow('Enregistrement impossible');
  });
  it('does not overwrite corrupt or unsupported storage', () => {
    for (const raw of ['broken json', '{"version":2,"lists":[]}', '{"version":1,"lists":[{}]}']) {
      const local = storage();
      local.setItem(SAVED_LISTS_KEY, raw);
      expect(() => saveList(local, createListSnapshot(context()))).toThrow();
      expect(local.getItem(SAVED_LISTS_KEY)).toBe(raw);
    }
  });
  it('rejects inconsistent or duplicated savings details', () => {
    const snapshot = createListSnapshot(context());
    snapshot.savings.amount = 99;
    expect(() => saveList(storage(), snapshot)).toThrow();
    const duplicate = createListSnapshot(context());
    duplicate.savings.entries.push(duplicate.savings.entries[0]);
    expect(() => saveList(storage(), duplicate)).toThrow();
  });
});
