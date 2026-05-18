import { createServer } from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import { spawn } from 'child_process';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { readFile, rm } from 'fs/promises';
import { homedir, tmpdir } from 'os';
import { basename, dirname, extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';
import { estimateBasketTotal, estimateCaveat, formatEstimateCad } from './price-estimate.js';

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

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

function buildPdfHtml(week: any, selectedItems: any[], notes = '') {
  const stores = groupByStore(selectedItems);
  const estimate = estimateBasketTotal(selectedItems);
  const caveat = estimateCaveat(estimate);
  const generated = new Intl.DateTimeFormat('fr-CA', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date());

  const storeBlocks = stores.map(store => `
    <section class="store">
      <h2>${escapeHtml(store.name)}</h2>
      ${store.address ? `<p class="address">${escapeHtml(store.address)}</p>` : ''}
      <table>
        <thead>
          <tr>
            <th>Produit</th>
            <th>Prix</th>
          </tr>
        </thead>
        <tbody>
          ${store.items.map(item => `
            <tr>
              <td>${escapeHtml(item.name)}</td>
              <td class="price">${escapeHtml(item.price)}</td>
            </tr>
          `).join('')}
          <tr class="subtotal-row">
            <td>Sous-total estimé</td>
            <td class="price">${escapeHtml(formatEstimateCad(store.estimate.subtotal))}</td>
          </tr>
        </tbody>
      </table>
      ${estimateCaveat(store.estimate) ? `<p class="estimate-note">${escapeHtml(estimateCaveat(store.estimate))}</p>` : ''}
    </section>
  `).join('');
  const finalTotalBlock = `
    <section class="final-total">
      <div>
        <span>Total estimé de la liste</span>
        <strong>${escapeHtml(formatEstimateCad(estimate.subtotal))}</strong>
      </div>
      <p>Avant taxes, dépôts, quantités réelles et prix au poids. ${escapeHtml(caveat)}</p>
    </section>
  `;

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(week.title || 'Liste d’épicerie')}</title>
  <style>
    @page { size: letter; margin: 0.55in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #171714;
      font-family: Avenir Next, Avenir, Helvetica, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.35;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: end;
      padding-bottom: 18px;
      border-bottom: 2px solid #171714;
      margin-bottom: 18px;
    }
    h1 {
      margin: 0;
      font-family: Georgia, Times New Roman, serif;
      font-size: 31px;
      line-height: 1;
    }
    .meta {
      color: #5f5a50;
      text-align: right;
      font-size: 11px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .summary div {
      border: 1px solid #d8cdbb;
      border-radius: 8px;
      padding: 9px 10px;
      background: #f8f5ed;
      font-weight: 800;
    }
    .store {
      break-inside: avoid;
      margin: 0 0 18px;
    }
    h2 {
      margin: 0 0 3px;
      font-size: 18px;
      line-height: 1.15;
    }
    .address {
      margin: 0 0 7px;
      color: #5f5a50;
      font-size: 11px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #d8cdbb;
    }
    th {
      color: #fff;
      background: #235845;
      text-align: left;
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    th, td {
      padding: 8px;
      border-bottom: 1px solid #e7dfd1;
      vertical-align: top;
    }
    tr:last-child td { border-bottom: 0; }
    .subtotal-row td {
      color: #235845;
      background: #e5f0e9;
      font-weight: 900;
    }
    td.price {
      width: 115px;
      color: #171714;
      font-weight: 900;
      white-space: nowrap;
    }
    .estimate-note,
    .estimate-caveat {
      margin: 6px 0 0;
      color: #5f5a50;
      font-size: 10.5px;
    }
    .estimate-caveat {
      margin: -8px 0 16px;
    }
    .notes {
      break-inside: avoid;
      margin: 0 0 18px;
      border: 1px solid #d8cdbb;
      border-radius: 8px;
      padding: 10px 12px;
      background: #f8f5ed;
    }
    .notes h2 {
      margin: 0 0 6px;
      font-size: 14px;
    }
    .notes p {
      margin: 0;
      white-space: pre-wrap;
    }
    .final-total {
      break-inside: avoid;
      margin-top: 22px;
      border: 2px solid #235845;
      border-radius: 10px;
      padding: 12px 14px;
      background: #e5f0e9;
    }
    .final-total div {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: baseline;
    }
    .final-total span {
      color: #235845;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .final-total strong {
      color: #235845;
      font-size: 18px;
      font-weight: 900;
      white-space: nowrap;
    }
    .final-total p {
      margin: 6px 0 0;
      color: #5f5a50;
      font-size: 10.5px;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Liste d'épicerie</h1>
      <div>${escapeHtml(week.weekRange || week.folderName || '')}</div>
    </div>
    <div class="meta">
      ${escapeHtml(selectedItems.length)} produit${selectedItems.length > 1 ? 's' : ''}<br />
      ${escapeHtml(stores.length)} épicerie${stores.length > 1 ? 's' : ''}<br />
      Généré le ${escapeHtml(generated)}
    </div>
  </header>
  <div class="summary">
    <div>${escapeHtml(selectedItems.length)} produits choisis</div>
    <div>${escapeHtml(stores.length)} arrêts</div>
    <div>Total estimé: ${escapeHtml(formatEstimateCad(estimate.subtotal))}</div>
    <div>Prix en CAD</div>
  </div>
  <p class="estimate-caveat">Avant taxes, dépôts, quantités réelles et prix au poids. ${escapeHtml(caveat)}</p>
  ${notes.trim() ? `<section class="notes"><h2>Notes</h2><p>${escapeHtml(notes.trim())}</p></section>` : ''}
  ${storeBlocks}
  ${finalTotalBlock}
</body>
</html>`;
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

    const weekPath = join(ROOT, 'data', 'weeks', slugFileName(weekSlug), 'week.json');
    if (!existsSync(weekPath)) {
      sendJson(res, 404, { error: 'Semaine introuvable.' });
      return;
    }

    const week = JSON.parse(await readFile(weekPath, 'utf8'));
    const allItems = [...(week.dealCategories ?? week.categories ?? []), ...(week.allCategories ?? [])]
      .flatMap((category: any) => category.items ?? []);
    const selectedItems = selectedIds
      .map((id: string) => allItems.find((item: any) => item.id === id))
      .filter(Boolean);

    if (selectedItems.length === 0) {
      sendJson(res, 400, { error: 'Aucun produit sélectionné trouvé dans la semaine.' });
      return;
    }

    const desktop = join(homedir(), 'Desktop');
    mkdirSync(desktop, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const baseName = `Liste epicerie - ${week.weekRange || week.folderName || stamp}`;
    const safeBase = slugFileName(baseName) || `liste-epicerie-${stamp}`;
    const outputPdf = join(desktop, `${safeBase}.pdf`);
    const tempHtml = join(tmpdir(), `${safeBase}-${Date.now()}.html`);
    writeFileSync(tempHtml, buildPdfHtml(week, selectedItems, notes), 'utf8');

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
