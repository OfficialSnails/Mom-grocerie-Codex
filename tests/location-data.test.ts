import { describe, expect, it, afterEach, vi } from 'vitest';
import data from '../website/data/store-locations.json';
// @ts-expect-error Shared browser module.
import { locationKey, searchLocations, distanceKm, nearestRegion, mapsUrl, locationError } from '../website/location-data.js';
// @ts-expect-error Shared browser module.
import { activeBranch, availableBranches, storeAddress } from '../website/store-directory.js';
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
    expect(new URL(mapsUrl('IGA', '', { lat: 46, lon: -73 })).searchParams.get('query')).toBe('46,-73');
    expect(locationError({ code: 1 })).toContain('refusée');
    expect(locationError({ code: 3 })).toContain('trop de temps');
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
