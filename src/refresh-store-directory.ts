import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { mergeLocatorRecords, addNearbyPlace, assertUniqueBranches } from './store-directory-enrichment.js';
// @ts-expect-error Shared browser geometry utilities.
import { locationKey, distanceKm } from '../website/location-data.js';

// Import a saved Overpass response, never scrape while a shopper uses the site.
// Query provenance and the read-only refresh procedure are recorded in the review.
const input = process.argv[2];
if (!input) throw new Error('Pass the saved OpenStreetMap/Overpass JSON response.');
const raw = input === '--cached' ? null : JSON.parse(readFileSync(resolve(input), 'utf8'));
if (raw && (raw.remark || !Array.isArray(raw.elements))) throw new Error('Incomplete location source; directory not changed.');
const target = resolve('website/data/store-locations.json');
const previous = JSON.parse(readFileSync(target, 'utf8'));
const importedAt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
const placeInput = process.argv[3] ?? 'output/location-canada.zip';
const places: any[] = placeInput === '--cached' ? previous.places : placeInput.endsWith('.zip')
  ? execFileSync('unzip', ['-p', placeInput, 'CA.txt'], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 }).split('\n')
    .map(row => row.split('\t'))
    .filter(row => row[10] === '10' && row[6] === 'P' && ['PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLC'].includes(row[7]!))
    .map(row => ({ id: `geonames-${row[0]}`, name: row[1], aliases: [row[2], ...(row[3] ?? '').split(',')].filter(Boolean),
      lat: Number(row[4]), lon: Number(row[5]), population: Number(row[14]), source: `https://www.geonames.org/${row[0]}` }))
  : JSON.parse(readFileSync(placeInput, 'utf8'));
let branches: any[] = raw ? [] : previous.branches.filter((branch: any) => branch.chainId);
function chain(tags: Record<string, string>) {
  const name = locationKey(`${tags.brand ?? ''} ${tags.name ?? ''}`);
  if (/\biga\b/.test(name)) return 'iga';
  if (/\bmetro\b/.test(name)) return 'metro';
  if (/\bmaxi\b/.test(name)) return 'maxi';
  if (/\bsuper c\b/.test(name)) return 'superc';
  if (/\bboni ?choix\b/.test(name)) return 'bonichoix';
  if (/\btradition\b/.test(name)) return 'tradition';
  if (/\b(?:intermarche|inter marche)\b/.test(name)) return 'intermarche';
  if (/\bcostco\b/.test(name)) return 'costco';
  if (/\bfamiliprix\b/.test(name)) return 'familiprix';
  return null;
}
for (const element of raw?.elements ?? []) {
  const tags = element.tags ?? {}, coords = element.center ?? element;
  if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lon)) continue;
  const location = { lat: coords.lat, lon: coords.lon };
  const source = `https://www.openstreetmap.org/${element.type}/${element.id}`;
  const chainId = chain(tags);
  if (!chainId || tags.amenity === 'fuel' || tags.disused === 'yes' || tags.shop === 'no') continue;
  const branch = { id: `osm-${element.type}-${element.id}`, chainId, name: tags.name ?? tags.brand,
    street: tags['addr:housenumber'] && tags['addr:street'] ? `${tags['addr:housenumber']} ${tags['addr:street']}` : tags['addr:full'] ?? '', city: tags['addr:city'] ?? '',
    postalCode: tags['addr:postcode'] ?? '', ...location, source, verifiedAt: importedAt };
  // Nodes and building outlines sometimes describe the same storefront.
  const duplicate = branches.findIndex(existing => existing.chainId === branch.chainId && distanceKm(existing, branch) < .10 &&
    (!existing.street || !branch.street || locationKey(existing.street) === locationKey(branch.street)));
  if (duplicate < 0) branches.push(branch);
  else if (!branches[duplicate].street && branch.street) branches[duplicate] = branch;
}
// Metro's public locator supplies its own coordinates and complete addresses.
// Optional saved HTML: never fetch provider pages during a shopper interaction.
if (process.argv[4] && process.argv[4] !== '--cached') {
  const html = readFileSync(resolve(process.argv[4]), 'utf8');
  const decode = (text: string) => text.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
  let count = 0;
  for (const match of html.matchAll(/<li class="fs--box-shop"([\s\S]*?)<\/li>/g)) {
    const block = match[1]!;
    const attribute = (name: string) => decode(block.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? '');
    const field = (name: string) => decode(block.match(new RegExp(`class="address--${name}"[^>]*>([^<]*)<`))?.[1] ?? '');
    if (field('provinceCode') !== 'QC') continue;
    const branch = { id: `metro-official-${attribute('data-store-id')}`, chainId: 'metro', name: attribute('data-store-name'),
      street: attribute('data-street'), city: field('city'), postalCode: field('postalCode'),
      lat: Number(attribute('data-store-lat')), lon: Number(attribute('data-store-lng')),
      source: `https://www.metro.ca/trouver-une-epicerie/${attribute('data-store-id')}`, verifiedAt: importedAt };
    if (!branch.street || !branch.lat || !branch.lon) throw new Error('Incomplete Metro locator record.');
    for (let i = branches.length - 1; i >= 0; i--) {
      if (branches[i].chainId === 'metro' && distanceKm(branches[i], branch) < .25) branches.splice(i, 1);
    }
    branches.push(branch); count++;
  }
  if (count < 100) throw new Error('Incomplete Metro locator snapshot; directory not changed.');
} else if (raw) {
  branches = mergeLocatorRecords(branches, previous.branches.filter((branch: any) => branch.id.startsWith('metro-official-')));
}
const observations = JSON.parse(readFileSync(resolve(process.argv[5] ?? 'data/store-locator-records.json'), 'utf8'));
branches = mergeLocatorRecords(branches, observations.branches,
  observations.sources.filter((source: any) => source.complete).map((source: any) => source.chainId));
branches.forEach(branch => addNearbyPlace(branch, places));
assertUniqueBranches(branches);
const regionCenters = Object.fromEntries([['joliette', 'Joliette'], ['montreal', 'Montréal'], ['quebec', 'Québec']].map(([id, name]) => {
  const place = places.find(place => place.name === name);
  if (!place) throw new Error(`Missing city coordinate for ${name}; directory not changed.`);
  return [id, { lat: place.lat, lon: place.lon, name, source: place.source }];
}));
if (branches.length < 30 || places.length < 100) throw new Error('Incomplete directory response; existing data preserved.');
const legacy = previous.branches.filter((branch: any) => !branch.chainId);
const statusFile = resolve('data/store-directory-status.json');
const status = existsSync(statusFile) ? JSON.parse(readFileSync(statusFile, 'utf8')) : {};
const writeJson = (path: string, value: unknown) => {
  writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n');
  renameSync(`${path}.tmp`, path);
};
writeJson(target, { ...previous, verifiedAt: importedAt,
  placesSource: 'https://download.geonames.org/export/dump/CA.zip',
  placesLicense: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: '© OpenStreetMap contributors · GeoNames', license: 'https://www.openstreetmap.org/copyright',
  sourceTimestamp: raw?.osm3s?.timestamp_osm_base ?? previous.sourceTimestamp, regionCenters,
  places: places.sort((a, b) => a.name.localeCompare(b.name, 'fr')), branches: [...legacy, ...branches] });
// Promote fetched observations only after a complete, validated import.
if (process.argv[5]) writeJson(resolve('data/store-locator-records.json'), observations);
writeJson(statusFile, { ...status, importedAt: new Date().toISOString(), importStatus: 'updated',
  sources: [...(status.sources ?? []).filter((entry: any) => entry.source !== 'directory'), { source: 'directory', status: 'updated' }] });
console.log(`${places.length} towns, ${branches.length} branch locations (${branches.filter(branch => branch.street).length} with addresses); ${legacy.length} existing verified branches retained.`);
