import { describe, expect, it } from 'vitest';
import { parseSobeysLocator, parseStorePage, sitemapLinks } from '../src/store-directory-sources.js';

const schema = { '@type': 'GroceryStore', name: 'Marché', address: {
  streetAddress: '123 rue Exemple', addressLocality: 'Montréal', addressRegion: 'QC', postalCode: 'H1A1A1',
} };
const page = (value: object, coordinates = '') => `<script type="application/ld+json">${JSON.stringify(value)}</script>${coordinates}`;
const coordinates = String.raw`\"_geoloc\":{\"lat\":45.5,\"lng\":-73.5}`;
const source = 'https://www.iga.ca/fr/magasins/example';

describe('public retailer location parsing', () => {
  it('discovers store pages only on the official origin and requested language', () => {
    expect(sitemapLinks('<loc>https://www.iga.ca/fr/magasins/one</loc><loc>https://www.iga.ca/en/stores/one</loc><loc>https://other.test/fr/magasins/one</loc>', 'https://www.iga.ca', /^\/fr\/magasins\//))
      .toEqual(['https://www.iga.ca/fr/magasins/one']);
  });
  it('reads changing IGA addresses from structured source data and unique map coordinates', () => {
    const first = parseStorePage(page(schema, coordinates), source, 'iga', '2026-10-03');
    expect(first).toMatchObject({ street: '123 rue Exemple', city: 'Montréal', postalCode: 'H1A 1A1', lat: 45.5, lon: -73.5 });
    const changed = { ...schema, address: { ...schema.address, streetAddress: '456 Autre rue' } };
    expect(parseStorePage(page(changed, coordinates), source, 'iga', '2026-10-04')?.street).toBe('456 Autre rue');
  });
  it('rejects missing or conflicting map data and ignores stores outside Québec', () => {
    expect(() => parseStorePage(page(schema), source, 'iga', '2026-10-03')).toThrow('Ambiguous');
    expect(() => parseStorePage(page(schema, coordinates + coordinates), source, 'iga', '2026-10-03')).toThrow('Ambiguous');
    expect(() => parseStorePage('<html>Unavailable</html>', source, 'iga', '2026-10-03')).toThrow('Missing store');
    expect(parseStorePage(page({ ...schema, address: { ...schema.address, addressRegion: 'NB' } }), source, 'iga', '2026-10-03')).toBeNull();
  });
  it('uses pharmacy coordinates instead of corporate office schema', () => {
    const pharmacy = { ...schema, '@type': 'Pharmacy', geo: { latitude: 46, longitude: -72 } };
    const html = page({ '@type': 'Organization', name: 'Headquarters' }) + page(pharmacy);
    expect(parseStorePage(html, 'https://www.familiprix.com/fr/pharmacies/example', 'familiprix', '2026-10-03'))
      .toMatchObject({ lat: 46, lon: -72, name: 'Familiprix Marché' });
  });
  it('extracts retailer names, coordinates and addresses without executing the page', () => {
    const html = `<div class='store-result ' data-id='10' data-lat='46' data-lng='-73' data-province='qc'>
      <a href='https://www.bonichoix.com/fr/stores/test/'><span class="name">Marché &amp; fils</span></a>
      <span class="location_address_address_1"><i></i>42 rue Principale</span><span class="city">Saint-Paul</span>
      <span class="postal_code">J0K3E0</span></div>`;
    expect(parseSobeysLocator(html, 'bonichoix', '2026-10-03')[0]).toMatchObject({
      id: 'bonichoix-official-10', name: 'Marché & fils', street: '42 rue Principale', city: 'Saint-Paul', postalCode: 'J0K 3E0', lat: 46,
    });
  });
});
