import { productTitle } from './product-details.js';
import { printColors, printMoney, printCount, printCaveat } from './pdf-document.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function buildShoppingPrintHtml({ week, stores, estimate, savings, notes = '' }) {
  const count = stores.reduce((sum, store) => sum + store.items.length, 0);
  const storeBlocks = stores.map(store => {
    return `<section class="store">
      <table><colgroup><col /><col style="width:88pt" /></colgroup><thead>
        <tr class="store-heading"><th colspan="2"><div class="store-destination"><h2>${escape(store.name)}</h2>${store.address ? `<p class="address">${escape(store.address)}</p>` : ''}</div></th></tr>
      </thead><tbody>
        ${store.items.map(item => `<tr><td>${escape(productTitle(item.name) || item.name)}</td><td class="price">${escape(item.price)}</td></tr>`).join('')}
        <tr class="subtotal-row"><td colspan="2"><div><span>Sous-total estimé</span><strong>${escape(printMoney(store.estimate.subtotal))}</strong></div></td></tr>
      </tbody></table>
    </section>`;
  }).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
    <title>${escape(['Ma liste d’épicerie', week?.weekRange || week?.folderName].filter(Boolean).join(' — '))}</title>
    <style>
      @page { size: letter; margin: 32pt; }
      * { box-sizing: border-box; }
      body { margin: 0; color: ${printColors.ink}; background: white; font: 9.5pt/1.35 Inter, Helvetica, Arial, sans-serif; }
      header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24pt; margin-bottom: 6pt; }
      h1 { margin: 0 0 5pt; font-size: 18pt; line-height: 1.15; letter-spacing: -.6pt; color: ${printColors.green}; }
      .context { font-size: 9pt; margin: 0; color: ${printColors.muted}; }
      .meta { flex-shrink: 0; text-align: right; font-size: 8pt; color: ${printColors.muted}; padding-top: 3pt; }
      .meta p { margin: 0 0 5pt; }
      .overview { display: flex; justify-content: space-between; gap: 24pt; padding: 0; color: ${printColors.green}; }
      .overview div { display: flex; align-items: baseline; gap: 6pt; }
      .overview div:last-child:not(:first-child) { text-align: right; }
      .overview span { display: block; font-size: 10pt; font-weight: normal; margin-bottom: 0; }
      .overview strong { display: block; font-size: 10pt; line-height: 1.2; }
      .overview div:first-child span { font-weight: bold; }
      .overview div:not(:first-child) strong { font-weight: normal; }
      .stores { margin-top: 14pt; break-after: avoid; }
      .store { margin: 0 0 10pt; }
      .store + .store { break-before: page; page-break-before: always; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; }
      tbody tr:nth-last-child(2) { break-after: avoid; }
      th, td { text-align: left; }
      .store-heading th { padding: 0; font-weight: normal; }
      .store-destination { display: flex; justify-content: space-between; align-items: center; gap: 24pt; padding: 6pt 8pt; border-radius: 3pt; background: ${printColors.green}; }
      .store-destination h2 { color: white; line-height: 14pt; }
      .store-destination .address { color: ${printColors.pale}; line-height: 11.5pt; }
      h2 { margin: 0; font-size: 12pt; line-height: 1.3; flex: 0 0 auto; max-width: 170pt; color: ${printColors.green}; }
      .address { margin: 0; text-align: right; color: ${printColors.muted}; font-size: 8.5pt; font-weight: normal; overflow-wrap: anywhere; }
      td { padding: 3pt 8pt; line-height: 12pt; border-bottom: .5pt solid ${printColors.rule}; vertical-align: middle; overflow-wrap: anywhere; }
      th.price, td.price { width: 88pt; text-align: right; }
      td.price { font-size: 10pt; font-weight: normal; color: ${printColors.ink}; }
      .subtotal-row td { padding: 6pt 8pt 4pt; border: 0; }
      .subtotal-row div { display: flex; justify-content: space-between; gap: 16pt; align-items: center; font-size: 9.5pt; color: ${printColors.green}; font-weight: bold; }
      .subtotal-row strong { font-size: 9.5pt; color: ${printColors.green}; white-space: nowrap; }
      .notes { margin: 0 0 10pt; break-after: avoid; }
      .notes h2 { font-size: 10pt; break-after: avoid; }
      .notes p { margin: 4pt 0 0; font-size: 9pt; color: ${printColors.muted}; white-space: pre-wrap; overflow-wrap: anywhere; orphans: 3; widows: 3; }
      .final-total { break-inside: avoid; }
      .final-total div { display: flex; align-items: center; justify-content: space-between; gap: 16pt; border-radius: 4pt; padding: 4pt 8pt; line-height: 16pt; color: white; background: ${printColors.green}; font-size: 10pt; font-weight: bold; }
      .final-total strong { font-size: 14pt; white-space: nowrap; }
      .final-total p { margin: 6pt 0 0; font-size: 8pt; color: ${printColors.muted}; }
      @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      @media screen { body { max-width: 612pt; margin: 24px auto; padding: 32pt; } }
    </style></head><body>
    <header><div><h1>Ma liste d’épicerie</h1><p class="context">${escape([week?.regionName, week?.weekRange || week?.folderName].filter(Boolean).join(' · '))}</p></div><div class="meta"><p>${escape(printCount(count, 'produit'))} · ${escape(printCount(stores.length, 'épicerie'))}</p></div></header>
    <section class="overview"><div><span>Total estimé :</span><strong>${escape(printMoney(estimate.subtotal))}</strong></div>${savings?.amount > 0 ? `<div><span>Économies :</span><strong>${escape(printMoney(savings.amount))}</strong></div>` : ''}</section>
    <div class="stores">${storeBlocks}</div>
    ${notes.trim() ? `<section class="notes"><h2>Notes</h2><p>${escape(notes.trim())}</p></section>` : ''}
    <section class="final-total"><div><span>Total estimé de la liste</span><strong>${escape(printMoney(estimate.subtotal))}</strong></div><p>${escape(printCaveat)}</p></section>
    </body></html>`;
}
