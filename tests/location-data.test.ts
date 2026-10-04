import { describe, expect, it, afterEach, vi } from 'vitest';
import data from '../website/data/store-locations.json';
// @ts-expect-error Shared browser module.
import { locationKey, searchLocations, distanceKm, nearestRegion, mapsUrl, locationError, readDevicePosition, branchDistanceLabel, locationCaption } from '../website/location-data.js';
// @ts-expect-error Shared browser module.
import { activeBranch, availableBranches, storeAddress, compactStoreAddress } from '../website/store-directory.js';
import { handleLocationApi } from '../src/location-api.js';

describe('location lookup and shared basket/PDF addresses', () => {
  it('matches accents, capitals and common Saint abbreviations', () => {
    expect(searchLocations(data, 'mOnTrEaL')[0].name).toBe('Montréal');
    expect(searchLocations(data, 'QUEBEC')[0].name).toBe('Québec');
    expect(searchLocations(data, 'Juliette')[0].name).toBe('Joliette');
    expect(searchLocations(data, 'st-jerome').some((p: any) => p.name === 'Saint-Jérôme')).toBe(true);
    expect(locationKey('Ste-Thérèse')).toBe(locationKey('Sainte Thérèse'));
    expect(searchLocations(data, 'zzzzmissing')).toEqual([]);
  });
  it('uses only finite coordinates and calculates geographic distances', () => {
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111.195, 2);
    expect(distanceKm({ lat: '45', lon: -73 }, data.regionCenters.montreal)).toBe(Infinity);
    expect(nearestRegion(data, data.regionCenters.quebec).id).toBe('quebec');
  });
  it('finds different nearest branches for a changed origin and honors manual choice', () => {
    const nearby = availableBranches(data, 'montreal', 'maxi-montreal');
    expect(nearby.length).toBeGreaterThan(2);
    const other = nearby[1];
    expect(activeBranch(data, 'montreal', 'maxi-montreal', {}, other).id).toBe(other.id);
    expect(activeBranch(data, 'montreal', 'maxi-montreal', { 'maxi-montreal': other.id }).id).toBe(other.id);
    expect(availableBranches(data, 'montreal', 'maxi-montreal', '', { lat: 0, lon: 0 })).toEqual([]);
  });
  it('does not accept a wrong-chain override or reuse a distant regional address', () => {
    const metro = availableBranches(data, 'montreal', 'metro-montreal')[0];
    const selected = activeBranch(data, 'montreal', 'maxi-montreal', { 'maxi-montreal': metro.id });
    expect(selected.chainId).toBe('maxi');
    expect(storeAddress({ storeId: 'maxi-montreal', storeAddress: 'Old address' }, data, 'montreal', {}, { lat: 0, lon: 0 })).toBe('');
  });
  it('keeps nearby stores with incomplete addresses instead of substituting a farther store', () => {
    const fixture = { branches: [
      { id: 'near', chainId: 'iga', name: 'IGA', lat: 46, lon: -73, street: '' },
      { id: 'far', chainId: 'iga', name: 'IGA', lat: 46.1, lon: -73, street: '1 Main' },
    ] };
    expect(activeBranch(fixture, 'joliette', 'iga-joliette', {}, { lat: 46, lon: -73 }).id).toBe('near');
    expect(storeAddress({ storeId: 'iga-joliette', storeAddress: 'Wrong branch' }, fixture, 'joliette', {}, { lat: 46, lon: -73 })).toBe('');
  });
  it('supplies sourced branch addresses in Montréal and Québec without changing prices', () => {
    for (const region of ['montreal', 'quebec']) {
      const item = { storeId: `metro-${region}`, currentPrice: 1.99 };
      expect(storeAddress(item, data, region)).toMatch(/^\d/);
      expect(item.currentPrice).toBe(1.99);
    }
    expect(data.branches.length).toBeGreaterThan(1000);
    expect(data.branches.every(branch => branch.source.startsWith('https://'))).toBe(true);
  });
  it('builds encoded map destinations and actionable permission errors', () => {
    const url = new URL(mapsUrl('IGA', '17 rue Gauthier, Québec'));
    expect(url.hostname).toBe('www.google.com');
    expect(url.searchParams.get('query')).toContain('17 rue Gauthier');
    expect(mapsUrl('IGA', '', { lat: 46, lon: -73 })).toBe('https://www.google.com/maps/search/IGA/@46,-73,16z');
    expect(locationError({ code: 1 })).toContain('refusée');
    expect(locationError({ code: 3 })).toContain('trop de temps');
  });
  it('opens a named storefront instead of a bare coordinate pin when the address is known', () => {
    const branch = data.branches.find(branch => branch.id === 'osm-node-6923703130');
    const url = new URL(mapsUrl('Maxi', '50 Avenue du Mont-Royal Ouest, Montréal', branch));
    expect(url.searchParams.get('query')).toBe('Maxi, 50 Avenue du Mont-Royal Ouest, Montréal, Québec, Canada');
    expect(url.searchParams.get('query')).not.toContain('45.519');
    expect(new URL(mapsUrl('IGA', '17 rue Gauthier, Québec', { lat: 46, lon: -73 })).searchParams.get('query')).toContain('17 rue Gauthier');
    const superC = data.branches.find(branch => branch.id === 'osm-node-12521638709');
    expect(new URL(mapsUrl('Super C', '', superC)).searchParams.get('query')).toContain('320 de la Visitation, St-Charles-Borromée');
  });
  it('shortens banner addresses without changing the full address used for PDF exports', () => {
    const address = '341 Chemin De Joliette,  C.P. 2940, Saint-Félix-De-Valois J0K 2M0';
    expect(compactStoreAddress(address)).toBe('341 Chemin De Joliette, Saint-Félix-De-Valois');
    expect(address).toContain('C.P. 2940');
    expect(compactStoreAddress('1445 boulevard Firestone, Joliette J6E 9E5')).toBe('1445 boulevard Firestone, Joliette');
    expect(compactStoreAddress('86, 8ième Rue, Crabtree J0K 1B0')).toBe('86, 8ième Rue, Crabtree');
    expect(compactStoreAddress('')).toBe('');
  });
});

describe('fresh device location', () => {
  afterEach(() => { vi.useRealTimers(); });
  it('requests uncached accurate coordinates and uses them to rank stores', async () => {
    const locations = availableBranches(data, 'montreal', 'maxi-montreal');
    let current = locations[0];
    const device = { getCurrentPosition: vi.fn((success: any, _failure: any, _options: any) => success({
      coords: { latitude: current.lat, longitude: current.lon, accuracy: 12 }, timestamp: Date.now(),
    })) };
    const first = await readDevicePosition(device);
    expect(activeBranch(data, 'montreal', 'maxi-montreal', {}, first).id).toBe(current.id);
    current = locations[1];
    const next = await readDevicePosition(device);
    expect(activeBranch(data, 'montreal', 'maxi-montreal', {}, next).id).toBe(current.id);
    expect(next.source).toBe('device');
    expect(next.accuracy).toBe(12);
    expect(device.getCurrentPosition.mock.calls[1]?.[2]).toEqual({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
  it('bounds a silent browser request and ignores a later success', async () => {
    vi.useFakeTimers();
    let resolvePosition: any;
    const request = readDevicePosition({ getCurrentPosition: (success: any) => { resolvePosition = success; } });
    const failed = expect(request).rejects.toMatchObject({ code: 3 });
    await vi.advanceTimersByTimeAsync(20000);
    await failed;
    resolvePosition({ coords: { latitude: 45, longitude: -73 }, timestamp: Date.now() });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('preserves permission failures and rejects invalid positions', async () => {
    await expect(readDevicePosition({ getCurrentPosition: (_: any, fail: any) => fail({ code: 1 }) })).rejects.toMatchObject({ code: 1 });
    await expect(readDevicePosition({ getCurrentPosition: (ok: any) => ok({ coords: { latitude: NaN, longitude: -73 } }) })).rejects.toMatchObject({ code: 2 });
  });
  it('distinguishes a town center from the device position in distances and status', () => {
    expect(branchDistanceLabel(2.345, null)).toBe('À 2,3 km');
    expect(branchDistanceLabel(2.345, { source: 'device' })).toBe('À 2,3 km de toi');
    expect(locationCaption(null, 'Joliette', 'Joliette et les environs')).toContain('Ta position n’a pas encore été utilisée');
    expect(locationCaption({ name: 'Crabtree', source: 'town' }, 'Joliette', 'Joliette')).toContain('Crabtree (centre-ville)');
    expect(locationCaption({ name: 'Ma position', source: 'device', capturedAt: '2026-10-03T23:00:00Z' }, '', 'Joliette')).toContain('Succursales les plus proches de ta position');
  });
  it('retains the official Crabtree address in the nearest branch and PDF lookup', () => {
    const branch = activeBranch(data, 'joliette', 'tradition-joliette');
    expect(branch.id).toBe('osm-node-470553049');
    expect(storeAddress({ storeId: 'tradition-joliette' }, data, 'joliette')).toBe('86, 8ième Rue, Crabtree J0K 1B0');
    expect(branch.addressSource).toBe('https://www.marchestradition.com/fr/stores/marche-tradition-4/');
  });
});

describe('optional server geocoder', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  async function call(path: string) {
    const result: any = {};
    const response = { writeHead: (status: number) => { result.status = status; }, end: (body: string) => { result.body = JSON.parse(body); } };
    await handleLocationApi(new URL(path, 'http://localhost'), response as any);
    return result;
  }
  it('reports missing configuration without exposing a key or making requests', async () => {
    vi.stubEnv('GEOAPIFY_API_KEY', '');
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await call('/api/location/config')).body).toEqual({ addressSearch: false });
    expect((await call('/api/location/search?q=Montreal')).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('filters provider results and keeps provider failure details private', async () => {
    vi.stubEnv('GEOAPIFY_API_KEY', 'test-only');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [
      { state_code: 'QC', formatted: 'Québec', lat: 46, lon: -71 },
      { state_code: 'ON', formatted: 'Toronto', lat: 43, lon: -79 },
      { state_code: 'QC', formatted: 'Invalid', lat: 'bad', lon: -73 },
    ] }) }));
    expect((await call('/api/location/search?q=Quebec')).body.results).toEqual([{ name: 'Québec', lat: 46, lon: -71 }]);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private test-only provider URL')));
    const failed = await call('/api/location/search?q=Quebec');
    expect(failed.status).toBe(502); expect(JSON.stringify(failed)).not.toContain('test-only');
  });
});
