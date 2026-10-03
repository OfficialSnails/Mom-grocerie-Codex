import { afterEach, describe, expect, it, vi } from 'vitest';
import { locationResponse } from '../src/location-api.js';
import { onRequest } from '../functions/api/location/[[path]].js';

afterEach(() => { vi.unstubAllGlobals(); });

describe('hosted location API', () => {
  it('reports configuration without exposing the provider key', async () => {
    const response = await locationResponse(new URL('https://example.com/api/location/config'), 'test-key');
    expect(await response.json()).toEqual({ addressSearch: true });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await (await locationResponse(new URL('https://example.com/api/location/config'))).json()).toEqual({ addressSearch: false });
  });

  it('keeps town and GPS fallback available when no key is configured', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const response = await locationResponse(new URL('https://example.com/api/location/search?q=Joliette'));
    expect(response.status).toBe(503);
    expect(await response.text()).toContain('Choisis une ville');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects unknown routes, unsupported methods and invalid input before contacting the provider', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await locationResponse(new URL('https://example.com/api/location/unknown'), 'test-key')).status).toBe(404);
    expect((await locationResponse(new URL('https://example.com/api/location/search?q=ab'), 'test-key')).status).toBe(400);
    const response = await onRequest({ request: new Request('https://example.com/api/location/search', { method: 'POST' }), env: {} });
    expect(response.status).toBe(405);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns only Québec coordinates and public address fields through the deployed handler', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [
      { formatted: 'Joliette, Québec', lat: 46.02, lon: -73.44, state_code: 'QC', private_field: 'not returned' },
      { formatted: 'Toronto', lat: 43.65, lon: -79.38, state_code: 'ON' },
      { formatted: 'Invalid', state_code: 'QC' },
    ] })));
    vi.stubGlobal('fetch', fetcher);
    const response = await onRequest({ request: new Request('https://example.com/api/location/search?q=Joliette'), env: { GEOAPIFY_API_KEY: 'test-key' } });
    expect(await response.json()).toEqual({ results: [{ name: 'Joliette, Québec', lat: 46.02, lon: -73.44 }] });
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('filter')).toBe('countrycode:ca');
  });

  it('redacts provider failures instead of returning a URL containing credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('https://provider.example/?apiKey=test-key')));
    const response = await locationResponse(new URL('https://example.com/api/location/search?q=Joliette'), 'test-key');
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('test-key');
  });
});
