import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseSobeysLocator, parseStorePage, sitemapLinks } from './store-directory-sources.js';
import type { Branch } from './store-directory-enrichment.js';

const root = resolve('output/directory-refresh');
mkdirSync(root, { recursive: true });
const cachePath = resolve('data/store-locator-records.json');
const previous = JSON.parse(readFileSync(cachePath, 'utf8'));
const records: Branch[] = previous.branches;
const sources = previous.sources ?? [];
const checkedAt = new Date().toISOString();
const verifiedAt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
const statuses: { source: string; status: string; count?: number; error?: string }[] = [];

async function download(url: string, storePage = false, timeout = 25000): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': 'BonsSpeciaux-Directory/1.0' } });
      if (storePage && (response.status === 404 || new URL(response.url).searchParams.get('closed') === 'true')) return '<!-- STORE_CLOSED -->';
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (attempt || (error instanceof Error && /HTTP 40[13]/.test(error.message))) throw error;
      await new Promise(done => setTimeout(done, 1000));
    }
  }
  throw new Error('Download failed');
}

function usable(branch: Branch) {
  return branch.name && branch.street && branch.city && branch.source.startsWith('https://') &&
    Number.isFinite(branch.lat) && branch.lat >= 44.9 && branch.lat <= 63 && branch.lon >= -80 && branch.lon <= -57;
}

async function collect(chainId: string, url: string, minimum: number, pagePattern?: RegExp) {
  try {
    const html = await download(url);
    let incoming: Branch[] = [];
    if (pagePattern) {
      const links = sitemapLinks(html, new URL(url).origin, pagePattern);
      if (links.length < minimum) throw new Error('Incomplete store sitemap');
      // Bounded concurrency; public store pages only, no account/API tokens.
      for (let i = 0; i < links.length; i += 4) {
        const batch = await Promise.all(links.slice(i, i + 4).map(async link => {
          const page = await download(link, true);
          if (page === '<!-- STORE_CLOSED -->') return null;
          return parseStorePage(page, link, chainId, verifiedAt);
        }));
        incoming.push(...batch.filter((branch): branch is Branch => !!branch));
        if (i % 80 === 0) console.log(`${chainId}: ${Math.min(i + 4, links.length)}/${links.length} store pages`);
      }
    } else incoming = parseSobeysLocator(html, chainId, verifiedAt);
    const rejected = incoming.filter(branch => !usable(branch));
    incoming = incoming.filter(usable);
    const lastCount = sources.find((entry: any) => entry.chainId === chainId)?.count ?? 0;
    if (incoming.length < Math.max(minimum, lastCount * .85)) throw new Error('Incomplete official store directory');
    for (let i = records.length - 1; i >= 0; i--) if (records[i]!.chainId === chainId) records.splice(i, 1);
    records.push(...incoming);
    const oldSource = sources.findIndex((source: any) => source.chainId === chainId);
    const source = { chainId, url, fetchedAt: checkedAt, complete: rejected.length === 0, count: incoming.length, rejected: rejected.length };
    if (oldSource < 0) sources.push(source); else sources[oldSource] = source;
    statuses.push({ source: chainId, status: rejected.length ? 'partial' : 'updated', count: incoming.length });
    if (rejected.length) console.warn(`${chainId}: ${rejected.length} records lack usable coordinates; not published as map points.`);
    console.log(`${chainId}: ${incoming.length} sourced branches`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Source failed';
    statuses.push({ source: chainId, status: 'retained', error: reason });
    console.warn(`${chainId}: ${reason}. Keeping the last successful observations.`);
  }
}

// Fetched data replaces each successful chain snapshot; other chains keep OSM coverage.
await collect('tradition', 'https://www.marchestradition.com/fr/store-locator/', 60);
await collect('bonichoix', 'https://www.bonichoix.com/fr/store-locator/', 30);
await collect('iga', 'https://www.iga.ca/sitemap/stores_fr/sitemap.xml', 200, /^\/fr\/magasins\//);
await collect('familiprix', 'https://www.familiprix.com/pharmacies_sitemap.xml', 250, /^\/fr\/pharmacies\/[^/]+\/?$/);

// Each base source can retain its last successful snapshot independently.
try {
  const query = '[out:json][timeout:60];area["ISO3166-2"="CA-QC"]["admin_level"="4"]->.qc;(nwr(area.qc)["shop"="supermarket"];nwr(area.qc)["brand"="Costco"];nwr(area.qc)["brand"="Familiprix"];nwr(area.qc)["amenity"="pharmacy"]["name"~"Familiprix",i];);out center tags;';
  const snapshot = resolve(root, 'records.json');
  writeFileSync(snapshot, JSON.stringify({ sources, branches: records }, null, 2) + '\n');
  const inputs = await Promise.all([
    (async () => {
      const osm = await download(`https://maps.mail.ru/osm/tools/overpass/api/interpreter?data=${encodeURIComponent(query)}`, false, 90000);
      const parsed = JSON.parse(osm);
      if (parsed.remark || !Array.isArray(parsed.elements) || parsed.elements.length < 1000) throw new Error('Incomplete OpenStreetMap response');
      writeFileSync(resolve(root, 'osm.json'), osm); return resolve(root, 'osm.json');
    })(),
    (async () => {
      const zip = await fetch('https://download.geonames.org/export/dump/CA.zip', { signal: AbortSignal.timeout(60000) });
      if (!zip.ok) throw new Error(`HTTP ${zip.status}`);
      writeFileSync(resolve(root, 'places.zip'), Buffer.from(await zip.arrayBuffer())); return resolve(root, 'places.zip');
    })(),
    (async () => {
      const metro = await download('https://www.metro.ca/trouver-une-epicerie');
      if ((metro.match(/class="fs--box-shop"/g) ?? []).length < 100) throw new Error('Incomplete Metro response');
      writeFileSync(resolve(root, 'metro.html'), metro); return resolve(root, 'metro.html');
    })(),
  ].map((task, index) => task.then(path => {
    statuses.push({ source: ['osm', 'geonames', 'metro'][index]!, status: 'updated' }); return path;
  }).catch(error => {
    const source = ['osm', 'geonames', 'metro'][index]!;
    statuses.push({ source, status: 'retained', error: error.message });
    console.warn(`${source}: ${error.message}. Using last successful directory data.`); return '--cached';
  })));
  execFileSync(resolve('node_modules/.bin/tsx'), ['src/refresh-store-directory.ts', ...inputs, snapshot], { stdio: 'inherit' });
  statuses.push({ source: 'directory', status: 'updated' });
} catch (error) {
  const reason = error instanceof Error ? error.message : 'Directory import failed';
  statuses.push({ source: 'directory', status: 'retained', error: reason });
  console.error(`Directory refresh failed: ${reason}. Published directory preserved.`);
  process.exitCode = 1;
}
writeFileSync('data/store-directory-status.json', JSON.stringify({ checkedAt,
  importStatus: process.exitCode ? 'retained' : 'updated', sources: statuses }, null, 2) + '\n');
