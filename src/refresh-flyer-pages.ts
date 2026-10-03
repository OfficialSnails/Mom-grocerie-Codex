import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

interface FlyerPage { left: number; right: number; top: number; bottom: number; page: number }
interface FlyerMetadata {
  id: number; path: string; height: number; resolutions: number[];
  thumbnail_url: string; valid_from: string; valid_to: string;
}
const base = 'https://backflipp.wishabi.com/flipp';
const headers = { Accept: 'application/json', Referer: 'https://flipp.com/' };
async function getJson(url: string) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Flyer pages: HTTP ${response.status}`);
  return response.json();
}

// Page geometry and images only. This never reads or rewrites product prices.
export function flyerPageMetadata(flyer: FlyerMetadata, pages: FlyerPage[]) {
  if (!/^flyers\/[a-z\d-]+\/$/i.test(flyer.path) || !flyer.resolutions?.length || !(flyer.height > 0)) {
    throw new Error(`Invalid flyer image metadata: ${flyer.id}`);
  }
  const level = Math.min(4, flyer.resolutions.length - 1);
  return {
    cover: flyer.thumbnail_url.replace(/^http:/, 'https:'),
    startsAt: flyer.valid_from, endsAt: flyer.valid_to,
    imageBase: `https://f.wishabi.net/${flyer.path}`,
    height: flyer.height, level, tileSpan: 256 * flyer.resolutions[level],
    pages: pages.filter(p => p.right > p.left && p.top > p.bottom)
      .sort((a, b) => a.page - b.page)
      .map(({ left, right, top, bottom, page }) => ({ left, right, top, bottom, page })),
  };
}

export async function refreshFlyerPages(folderName?: string) {
  const index = JSON.parse(readFileSync(resolve('website/data/weeks/index.json'), 'utf8'));
  const weeks = Array.isArray(index) ? index : index.weeks;
  const week = folderName ? weeks.find((w: { folderName: string }) => w.folderName === folderName) : weeks[0];
  if (!week) throw new Error('No matching published website week for flyer pages');
  const file = resolve('website/data/weeks', week.slug, 'flyers.json');
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const catalog = await getJson(`${base}/flyers?locale=fr-CA&postal_code=J6E3N2`) as { flyers: FlyerMetadata[] };
  for (const source of data.flyers) {
    const flyer = catalog.flyers.find(f => String(f.id) === source.id);
    if (!flyer) { console.warn(`Flyer ${source.id}: unavailable in current catalog; existing pages preserved.`); continue; }
    const detail = await getJson(`${base}/flyers/${flyer.id}?locale=fr-CA&include=page_items`) as { pages: FlyerPage[] };
    Object.assign(source, flyerPageMetadata(flyer, detail.pages ?? []));
  }
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log(`Flyer page metadata updated: ${week.slug} (${data.flyers.filter((f: { pages?: unknown[] }) => f.pages?.length).length} readers)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  refreshFlyerPages(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
}
