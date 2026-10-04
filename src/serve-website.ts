import 'dotenv/config';
import { handleLocationApi } from './location-api.js';
import { accountResponse } from './account-api.js';
import { orderResponse } from './order-api.js';
import { createServer } from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import { spawn } from 'child_process';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { readFile, rm } from 'fs/promises';
import { homedir, tmpdir } from 'os';
import { basename, dirname, extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';
// @ts-expect-error Shared browser module has no TypeScript declaration.
import { prepareOfferIds, applyOfferEvidence } from '../website/offer-identity.js';
// @ts-expect-error Shared browser module has no TypeScript declaration.
import { basketSavings } from '../website/product-details.js';
// @ts-expect-error Shared browser module has no TypeScript declaration.
import { storeAddress } from '../website/store-directory.js';
import { estimateBasketTotal } from './price-estimate.js';
// @ts-expect-error Shared browser module has no TypeScript declaration.
import { buildShoppingPrintHtml } from '../website/print-document.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'website');
const PORT = Number(process.env.PORT ?? 4187);
const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function resolvePath(urlPath: string): string {
  const decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  const withoutLeadingSlash = decoded.replace(/^[/\\]+/, '');
  const normalized = normalize(withoutLeadingSlash).replace(/^(\.\.[/\\])+/, '');
  const target = join(ROOT, normalized === '' ? 'index.html' : normalized);
  if (!target.startsWith(ROOT)) return join(ROOT, 'index.html');
  if (existsSync(target) && statSync(target).isDirectory()) return join(target, 'index.html');
  return target;
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    if (Buffer.concat(chunks).length > 1024 * 1024) throw new Error('Request body too large');
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function slugFileName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function findChrome(): string | null {
  return CHROME_PATHS.find(path => existsSync(path)) ?? null;
}

function groupByStore(items: any[]) {
  const stores = new Map<string, { name: string; address: string; items: any[]; estimate: ReturnType<typeof estimateBasketTotal> }>();
  for (const item of items) {
    const key = item.storeId || item.storeName || 'store';
    if (!stores.has(key)) {
      stores.set(key, {
        name: item.storeName || 'Épicerie',
        address: item.storeAddress || '',
        items: [],
        estimate: estimateBasketTotal([]),
      });
    }
    stores.get(key)?.items.push(item);
  }
  for (const store of stores.values()) {
    store.estimate = estimateBasketTotal(store.items);
  }
  return [...stores.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

function buildPdfHtml(week: any, selectedItems: any[], notes = '', savings = { amount: 0, count: 0, member: false }) {
  return buildShoppingPrintHtml({
    week, stores: groupByStore(selectedItems), estimate: estimateBasketTotal(selectedItems), savings, notes,
  });
}

async function runChromePdf(inputHtml: string, outputPdf: string) {
  const chrome = findChrome();
  if (!chrome) throw new Error('Google Chrome ou Chromium est nécessaire pour créer le PDF automatiquement.');

  await new Promise<void>((resolve, reject) => {
    const child = spawn(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-extensions',
      `--print-to-pdf=${outputPdf}`,
      '--print-to-pdf-no-header',
      '--no-pdf-header-footer',
      `file://${inputHtml}`,
    ], { stdio: 'ignore' });

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0 && existsSync(outputPdf)) resolve();
      else reject(new Error(`Chrome PDF export failed with code ${code ?? 'unknown'}`));
    });
  });
}

async function handlePdfExport(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await readJsonBody(req);
    const weekSlug = String(body.weekSlug || '');
    const selectedIds = Array.isArray(body.selectedIds) ? body.selectedIds.map(String) : [];
    const notes = String(body.notes || '');
    if (!weekSlug || selectedIds.length === 0) {
      sendJson(res, 400, { error: 'Sélection vide ou semaine manquante.' });
      return;
    }

    const regionId = String(body.regionId || 'joliette');
    const registry = JSON.parse(await readFile(join(ROOT, 'data/regions.json'), 'utf8'));
    const region = registry.regions.find((entry: any) => entry.id === regionId);
    if (!region) { sendJson(res, 400, { error: 'Région inconnue.' }); return; }
    const regionIndex = JSON.parse(await readFile(join(ROOT, region.indexPath), 'utf8'));
    const meta = regionIndex.weeks.find((entry: any) => entry.slug === weekSlug);
    if (!meta) { sendJson(res, 404, { error: 'Semaine introuvable dans cette région.' }); return; }
    const weekPath = join(ROOT, meta.path);
    if (!existsSync(weekPath)) {
      sendJson(res, 404, { error: 'Semaine introuvable.' });
      return;
    }

    const week = prepareOfferIds(JSON.parse(await readFile(weekPath, 'utf8')));
    const allItems = [...(week.dealCategories ?? week.categories ?? []), ...(week.allCategories ?? [])]
      .flatMap((category: any) => category.items ?? []);
    const evidencePath = join(dirname(weekPath), 'offer-evidence.json');
    if (existsSync(evidencePath)) {
      const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
      for (const item of allItems) applyOfferEvidence(item, evidence.offers[item.id]);
    }
    const selectedItems = [...new Set<string>(selectedIds)]
      .map((id: string) => allItems.find((item: any) => item.id === id))
      .filter(Boolean);

    if (selectedItems.length === 0) {
      sendJson(res, 400, { error: 'Aucun produit sélectionné trouvé dans la semaine.' });
      return;
    }

    const desktop = join(homedir(), 'Desktop');
    mkdirSync(desktop, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const baseName = `Ma liste epicerie - ${regionId === 'joliette' ? '' : `${region.name} - `}${week.weekRange || week.folderName || stamp}`;
    const safeBase = slugFileName(baseName) || `ma-liste-epicerie-${stamp}`;
    const outputPdf = join(desktop, `${safeBase}.pdf`);
    const tempHtml = join(tmpdir(), `${safeBase}-${Date.now()}.html`);
    const directory = JSON.parse(await readFile(join(ROOT, 'data/store-locations.json'), 'utf8'));
    const branchChoices = body.branchChoices && typeof body.branchChoices === 'object' ? body.branchChoices : {};
    const addressedItems = selectedItems.map((item: any) => ({
      ...item, storeAddress: storeAddress(item, directory, regionId, branchChoices, body.location),
    }));
    const storeIds = new Set(Array.isArray(body.storeIds) ? body.storeIds.map(String) : allItems.map((item: any) => item.storeId));
    const savings = basketSavings(selectedItems, allItems, storeIds);
    writeFileSync(tempHtml, buildPdfHtml(week, addressedItems, notes, savings), 'utf8');

    try {
      await runChromePdf(tempHtml, outputPdf);
    } finally {
      await rm(tempHtml, { force: true });
    }

    sendJson(res, 200, {
      ok: true,
      path: outputPdf,
      fileName: basename(outputPdf),
      itemCount: selectedItems.length,
    });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Export PDF impossible.' });
  }
}

createServer((req, res) => {
  const requestUrl = new URL(req.url ?? '/', 'http://localhost');
  if (requestUrl.pathname.startsWith('/api/account/') || requestUrl.pathname.startsWith('/api/order/')) {
    void (async () => {
      try {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const method = req.method ?? 'GET';
        const body = ['GET', 'HEAD'].includes(method) ? undefined : JSON.stringify(await readJsonBody(req));
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(name, value);
        const handler = requestUrl.pathname.startsWith('/api/order/') ? orderResponse : accountResponse;
        const response = await handler(new Request(url, { method, headers, body }), process.env);
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        res.end(await response.text());
      } catch { sendJson(res, 400, { error: 'Requête invalide.' }); }
    })();
    return;
  }
  if (req.method === 'GET' && ['/api/location/config', '/api/location/search'].includes(requestUrl.pathname)) {
    void handleLocationApi(requestUrl, res);
    return;
  }
  if (req.method === 'POST' && (req.url ?? '').startsWith('/api/export-pdf')) {
    void handlePdfExport(req, res);
    return;
  }

  const target = resolvePath(req.url ?? '/');
  if (!existsSync(target)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'content-type': MIME[extname(target)] ?? 'application/octet-stream',
    'cache-control': 'no-store, max-age=0',
  });
  createReadStream(target).pipe(res);
}).listen(PORT, () => {
  console.log(`Site local: http://localhost:${PORT}`);
});
