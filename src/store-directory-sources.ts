import type { Branch } from './store-directory-enrichment.js';

export const decodeHtml = (value: string) => value.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) =>
  String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
const text = (value: string) => decodeHtml(value.replace(/<[^>]*>/g, '')).trim();
const postal = (value: string) => value.replace(/\s/g, '').toUpperCase().replace(/^(.{3})(.{3})$/, '$1 $2');

export function parseSobeysLocator(html: string, chainId: string, verifiedAt: string): Branch[] {
  const records: Branch[] = [];
  for (const block of html.split(/(?=<div\s+class=['"]store-result[ '\"])/).filter(block => /^<div\s+class=['"]store-result[ '\"]/.test(block))) {
    const attr = (key: string) => decodeHtml(block.match(new RegExp(`\\b${key}=['"]([^'"]*)['"]`))?.[1] ?? '');
    const field = (key: string) => text(block.match(new RegExp(`<span class="${key}">([\\s\\S]*?)</span>`))?.[1] ?? '');
    if (attr('data-province').toLowerCase() !== 'qc') continue;
    const source = block.match(/href=['"]([^'"]+\/stores\/[^'"]+)['"]/i)?.[1] ?? '';
    records.push({ id: `${chainId}-official-${attr('data-id')}`, chainId, name: field('name'),
      street: field('location_address_address_1'), city: field('city'), postalCode: postal(field('postal_code')),
      lat: Number(attr('data-lat')), lon: Number(attr('data-lng')), source: decodeHtml(source), verifiedAt });
  }
  return records;
}

export function sitemapLinks(xml: string, origin: string, path: RegExp) {
  return [...new Set([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => decodeHtml(match[1]!)))]
    .filter(link => { const url = new URL(link); return url.origin === origin && path.test(url.pathname); });
}

export function parseStorePage(html: string, source: string, chainId: string, verifiedAt: string): Branch | null {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap(match => { const value = JSON.parse(match[1]!); return Array.isArray(value) ? value : value['@graph'] ?? [value]; });
  const store = blocks.find(value => ['GroceryStore', 'Pharmacy'].includes(value['@type']));
  if (!store?.address) throw new Error(`Missing store schema: ${source}`);
  if (store.address.addressRegion?.toUpperCase() !== 'QC') return null;
  let lat = store.geo?.latitude, lon = store.geo?.longitude;
  if (chainId === 'iga') {
    // Public store page's serialized map coordinates; never execute provider scripts.
    const coords = [...html.matchAll(/\\"_geoloc\\":\{\\"lat\\":([\d.-]+),\\"lng\\":([\d.-]+)\}/g)];
    if (coords.length !== 1) throw new Error(`Ambiguous store map coordinates: ${source}`);
    lat = Number(coords[0]![1]); lon = Number(coords[0]![2]);
  }
  const slug = new URL(source).pathname.split('/').filter(Boolean).pop()!;
  return { id: `${chainId}-official-${slug}`, chainId,
    name: new RegExp(`^${chainId}\\b`, 'i').test(store.name) ? store.name : `${chainId === 'iga' ? 'IGA' : 'Familiprix'} ${store.name}`,
    street: store.address.streetAddress, city: store.address.addressLocality,
    postalCode: postal(store.address.postalCode ?? ''), lat: Number(lat), lon: Number(lon), source, verifiedAt };
}
