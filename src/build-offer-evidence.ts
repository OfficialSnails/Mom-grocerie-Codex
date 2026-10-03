import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import Papa from 'papaparse';
// @ts-expect-error Shared browser module has no TypeScript declaration.
import { prepareOfferIds } from '../website/offer-identity.js';
import { evidenceFor, historicalEvidence, observedHistory, historyCatalog, identity, type HistoryRow, type ProofFact } from './offer-evidence.js';
import type { RawDealItem } from '../sources/source-adapter.js';

interface WebsiteItem { id: string; proofImageUrl: string; sourceStoreId: string; storeId: string; currentPrice: number; name: string }
export function buildOfferEvidence(folderName?: string, historyOnly = false) {
  const registryPath = resolve('website/data/regions.json');
  const regions = existsSync(registryPath) ? JSON.parse(readFileSync(registryPath, 'utf8')).regions
    : [{ id: 'joliette', indexPath: 'data/weeks/index.json' }];
  const weeks = regions.flatMap((region: { id: string; indexPath: string }) =>
    JSON.parse(readFileSync(resolve('website', region.indexPath), 'utf8')).weeks.map((meta: object) => ({ ...meta, regionId: region.id })));
  const facts: Record<string, ProofFact> = JSON.parse(readFileSync(resolve('data/offer-proof-facts.json'), 'utf8')).proofs;
  const history = Papa.parse<HistoryRow>(readFileSync(resolve('data/historical_prices.csv'), 'utf8'), { header: true, skipEmptyLines: true }).data;
  const historyByProduct = new Map<string, HistoryRow[]>();
  for (const row of history) {
    const key = `${row.store}|${identity(row.item_name || '')}`;
    if (!historyByProduct.has(key)) historyByProduct.set(key, []);
    historyByProduct.get(key)!.push(row);
  }
  const storeNames = Object.fromEntries(weeks.flatMap((meta: { path: string }) =>
    JSON.parse(readFileSync(resolve('website', meta.path), 'utf8')).stores.map((store: { id: string; name: string }) => [store.id, store.name])));
  storeNames['bonichoix-stemilie'] = 'BoniChoix · Saint-Émilie';
  const rawFiles = new Set<string>();
  for (const name of readdirSync(resolve('reports/raw'))) {
    if (/^bons-speciaux-joliette-\d{4}-\d{2}-\d{2}-raw-items\.json$/.test(name)) rawFiles.add(resolve('reports/raw', name));
  }
  for (const name of readdirSync(resolve('reports/weeks'))) {
    const path = resolve('reports/weeks', name, 'Autres/raw-items.json');
    if (existsSync(path)) rawFiles.add(path);
  }
  const archivedOffers: RawDealItem[] = [...rawFiles].flatMap(path => JSON.parse(readFileSync(path, 'utf8')))
    .filter((offer: RawDealItem) => {
      const proof = facts[offer.source_image_url ?? ''];
      return !proof || proof.currentPrice !== offer.current_price || !proof.verifiedPrice || proof.verifiedPrice === offer.current_price;
    }).map((offer: RawDealItem) => {
      const proof = facts[offer.source_image_url ?? ''];
      return { ...offer, source_proof_crop: proof?.currentPrice === offer.current_price ? proof.proofCrop ?? offer.source_proof_crop : offer.source_proof_crop };
    });
  const archive = historyCatalog(history, storeNames, archivedOffers);
  writeFileSync(resolve('website/data/price-history.json'), JSON.stringify({ generatedAt: new Date().toISOString(), ...archive }) + '\n');
  console.log(`Price archive: ${archive.observationCount} observations, ${archive.series.reduce((sum, item) => sum + item.points.filter(point => point.proofImageUrl).length, 0)} with matching source photos.`);
  if (historyOnly) return;
  for (const meta of weeks.filter((w: { folderName: string }) => !folderName || w.folderName === folderName)) {
    const directory = dirname(resolve('website', meta.path));
    const week = prepareOfferIds(JSON.parse(readFileSync(join(directory, 'week.json'), 'utf8')));
    const previousPath = join(directory, 'offer-evidence.json');
    const previous = existsSync(previousPath) ? JSON.parse(readFileSync(previousPath, 'utf8')).offers : {};
    const weekStart = week.allCategories[0].items[0].id.slice(0, 10);
    const rawPath = meta.regionId === 'joliette' ? resolve('reports/weeks', week.folderName, 'Autres/raw-items.json')
      : resolve('reports/regions', meta.regionId, weekStart, 'raw-items.json');
    if (!existsSync(rawPath)) throw new Error(`Missing source snapshot: ${week.folderName}`);
    const raw: RawDealItem[] = JSON.parse(readFileSync(rawPath, 'utf8'));
    const items: WebsiteItem[] = [...new Map<string, WebsiteItem>([...week.allCategories, ...week.dealCategories].flatMap((c: { items: WebsiteItem[] }) => c.items).map((item: WebsiteItem) => [item.id, item])).values()];
    const offers: Record<string, unknown> = {};
    for (const item of items) {
      const source = raw.find(r => r.store_id === (item.sourceStoreId ?? item.storeId) && r.source_image_url === item.proofImageUrl && identity(r.item_name) === identity(item.name) && Math.abs(r.current_price - item.currentPrice) < .001);
      if (!source) continue;
      const evidence = evidenceFor(source, facts[item.proofImageUrl]);
      const prior = previous[item.id];
      if (!evidence.proofCrop && prior?.source === evidence.source && prior?.fetchedPrice === evidence.fetchedPrice) {
        evidence.proofCrop = prior.proofCrop;
      }
      const priorRows = historyByProduct.get(`${source.store_id}|${identity(source.item_name)}`) ?? [];
      evidence.history = historicalEvidence(source, evidence, priorRows, weekStart);
      if (!evidence.history) evidence.observations = observedHistory(source, priorRows, weekStart);
      offers[item.id] = evidence;
    }
    writeFileSync(join(directory, 'offer-evidence.json'), JSON.stringify({ generatedAt: new Date().toISOString(), weekStart, offers }, null, 2) + '\n');
    console.log(`${meta.regionId}/${meta.slug}: ${Object.keys(offers).length} offer records, ${Object.values(offers).filter((e: any) => e.format).length} confirmed formats, ${Object.values(offers).filter((e: any) => e.history).length} historical benchmarks.`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildOfferEvidence(process.argv[2] === '--history-only' ? undefined : process.argv[2], process.argv.includes('--history-only'));
}
