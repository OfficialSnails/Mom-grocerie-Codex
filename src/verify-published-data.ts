import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const root = resolve('website');
const read = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

export async function verifyPublishedData() {
  const index = read('data/weeks/index.json');
  if (!index.weeks?.[0]?.slug) throw new Error('Missing newest production week');
  const files = new Set(['data/weeks/index.json', 'data/regions.json', 'data/price-history.json']);
  for (const region of read('data/regions.json').regions) {
    files.add(region.indexPath);
    const week = read(region.indexPath).weeks[0];
    if (week?.slug !== index.weeks[0].slug) throw new Error(`Stale regional week: ${region.id}`);
    for (const name of ['week.json', 'flyers.json', 'offer-evidence.json']) {
      files.add(`${dirname(week.path)}/${name}`);
    }
  }
  for (const file of files) {
    const expected = readFileSync(resolve(root, file), 'utf8');
    let matched = false;
    // ponytail: bounded propagation retries; stale data still fails the deployment check.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await setTimeout(5000);
      const url = new URL(file, 'https://bons-speciaux-joliette.pages.dev/');
      url.searchParams.set('verify', String(Date.now()));
      const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'Cache-Control': 'no-cache' } });
      if (response.ok && await response.text() === expected) { matched = true; break; }
    }
    if (!matched) throw new Error(`Published data does not match the release: ${file}`);
  }
  console.log(`Published data verified: ${index.weeks[0].folderName} (${files.size} files)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  verifyPublishedData().catch(error => { console.error(error); process.exitCode = 1; });
}
