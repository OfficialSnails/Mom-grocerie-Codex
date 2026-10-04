import { describe, expect, it } from 'vitest';
import { mergeLocatorRecords, addNearbyPlace, assertUniqueBranches } from '../src/store-directory-enrichment.js';
import directory from '../website/data/store-locations.json';
// @ts-expect-error Shared browser utilities.
import { branchLocationLabel, availableBranches, activeBranch, storeAddress } from '../website/store-directory.js';
// @ts-expect-error Shared browser utilities.
import { mapsUrl, readDevicePosition } from '../website/location-data.js';

const point = { id: 'osm-one', chainId: 'tradition', name: 'Tradition', street: '', city: '', postalCode: '',
  lat: 46, lon: -73, source: 'https://www.openstreetmap.org/node/1', verifiedAt: '2026-10-03' };
const official = { ...point, id: 'official-one', name: 'Marché Tradition', street: '12, rue Principale', city: 'Ville',
  postalCode: 'J0K 1A0', source: 'https://www.marchestradition.com/fr/stores/example/' };

describe('source-backed directory enrichment', () => {
  it('fills an address while retaining a saved branch choice and coordinate provenance', () => {
    const [branch] = mergeLocatorRecords([point], [official]);
    expect(branch).toMatchObject({ id: point.id, street: official.street, source: point.source, addressSource: official.source });
    expect(point.street).toBe('');
    expect(activeBranch({ branches: [branch] }, 'joliette', 'tradition-joliette', { 'tradition-joliette': point.id }, point).id).toBe(point.id);
  });
  it('adds a verified missing branch once, without replacing a nearby different chain', () => {
    const other = { ...point, chainId: 'iga' };
    const once = mergeLocatorRecords([other], [official]);
    expect(once).toHaveLength(2);
    expect(mergeLocatorRecords(once, [official])).toHaveLength(2);
    expect(once[0]).toEqual(other);
  });
  it('updates changed source addresses and coordinates on the next refresh', () => {
    const verified = { ...point, street: 'Old address', addressSource: official.source };
    const moved = { ...official, lat: 46.2, street: '45 Nouvelle rue' };
    expect(mergeLocatorRecords([verified], [moved])[0]).toMatchObject({ id: point.id, lat: 46.2, street: '45 Nouvelle rue' });
  });
  it('preserves neighbouring official stores with different addresses on repeated refreshes', () => {
    const nearby = { ...official, id: 'official-two', street: '14, rue Principale', lat: 46.001,
      source: 'https://www.marchestradition.com/fr/stores/second/' };
    const once = mergeLocatorRecords([point], [official, nearby], ['tradition']);
    expect(once).toHaveLength(2);
    expect(mergeLocatorRecords(once, [official, nearby], ['tradition'])).toHaveLength(2);
  });
  it('deduplicates equivalent street abbreviations without dropping suite numbers', () => {
    const same = { ...official, id: 'official-two', source: `${official.source}alternate`, street: '12 ave. Principale' };
    const original = { ...official, street: '12 avenue Principale' };
    expect(mergeLocatorRecords([original], [same])).toHaveLength(1);
    expect(mergeLocatorRecords([original], [{ ...same, street: '12 avenue Principale, local 2' }])).toHaveLength(2);
  });
  it('retires stale banner listings only for complete official chain snapshots', () => {
    const stale = { ...point, id: 'old-store', lat: 47 };
    expect(mergeLocatorRecords([stale], [official], ['tradition']).map(b => b.id)).toEqual([official.id]);
    expect(mergeLocatorRecords([stale], [official])).toHaveLength(2);
  });
  it('collapses duplicate map points only when both match the official address', () => {
    const a = { ...point, street: official.street, city: official.city, lat: 46.001 };
    const b = { ...a, id: 'osm-two', lat: 46.00001 };
    expect(mergeLocatorRecords([a, b], [official])).toHaveLength(1);
    expect(mergeLocatorRecords([a, b], [official])[0]?.id).toBe('osm-two');
    expect(() => mergeLocatorRecords([a, { ...b, street: '99 Other' }], [official])).toThrow('Ambiguous');
  });
  it('rejects partial observations and invalid/duplicate directory points', () => {
    expect(() => mergeLocatorRecords([], [{ ...official, street: '' }])).toThrow('Incomplete');
    expect(() => mergeLocatorRecords([], [{ ...official, lat: NaN }])).toThrow('Incomplete');
    expect(() => assertUniqueBranches([point, point])).toThrow('Duplicate');
    expect(() => assertUniqueBranches([{ ...point, lon: 200 }])).toThrow('Invalid');
  });
  it('labels approximate locality without turning it into a street address or PDF address', () => {
    const branch = addNearbyPlace({ ...point }, [{ name: 'Nearby village', lat: 46.01, lon: -73, source: 'https://www.geonames.org/1' }]);
    expect(branch.city).toBe('');
    expect(branch.street).toBe('');
    expect(branchLocationLabel(branch)).toBe('Près de Nearby village');
    const data = { branches: [branch] };
    expect(availableBranches(data, 'joliette', 'tradition-joliette', 'nearby village', point)).toHaveLength(1);
    expect(storeAddress({ storeId: 'tradition-joliette' }, data, 'joliette', {}, point)).toBe('');
    expect(mapsUrl(branch.name, '', branch)).toContain('/@46,-73,16z');
  });
  it('keeps an incomplete common street map search centered on its actual point', () => {
    const branch = { ...point, name: 'IGA', street: '12 rue Principale' };
    const url = mapsUrl(branch.name, branch.street, branch);
    expect(decodeURIComponent(url)).toContain('IGA, 12 rue Principale/@46,-73,16z');
  });
  it('shows the real addresses near Sainte-Émélie and removes the stale IGA banner', async () => {
    const town = directory.places.find(p => p.id === 'geonames-6137875')!;
    const gps = await readDevicePosition({ getCurrentPosition: (ok: any) => ok({
      coords: { latitude: town.lat, longitude: town.lon, accuracy: 10 }, timestamp: Date.now(),
    }) });
    const branches = availableBranches(directory, 'joliette', 'iga-joliette', '', gps);
    expect(branches.every((branch: any) => branch.street && branch.city)).toBe(true);
    expect(branches[0]).toMatchObject({ id: 'osm-node-4618281037', street: '3100 rue Henri-L.-Chevrette' });
    expect(branches.some((branch: any) => branch.id === 'osm-node-4596500239')).toBe(false);
    expect(availableBranches(directory, 'joliette', 'tradition-joliette', 'Sainte Mélanie', gps)[0])
      .toMatchObject({ id: 'tradition-official-92924', chainId: 'tradition', street: '851, route Principale' });
    for (const chain of ['bonichoix', 'familiprix']) {
      expect(activeBranch(directory, 'joliette', `${chain}-joliette`, {}, gps).city).toBe(town.name);
    }
  });
  it('gives every current branch readable location context and finite, increasing GPS distances', () => {
    for (const branch of directory.branches) {
      expect(branchLocationLabel(branch)).not.toBe('Voir sur la carte');
    }
    for (const origin of [directory.regionCenters.montreal, directory.regionCenters.quebec, { lat: 46.31677, lon: -73.64917 }]) {
      for (const chain of ['iga', 'metro', 'maxi', 'superc', 'tradition', 'bonichoix', 'familiprix', 'costco', 'intermarche']) {
        const branches = availableBranches(directory, 'joliette', `${chain}-joliette`, '', origin);
        expect(new Set(branches.map((b: any) => b.id)).size).toBe(branches.length);
        branches.forEach((branch: any, i: number) => {
          if (branch.chainId) expect(branch.distance).toBeLessThanOrEqual(50);
          if (i) expect(branch.distance).toBeGreaterThanOrEqual(branches[i - 1].distance);
        });
      }
    }
  });
});
