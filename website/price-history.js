import { money } from './product-details.js';
import { historyDate, historyTitle, historySource, historyFormat, historyStats, filterHistory, flyerHistoryCatalog } from './price-history-data.js';
import { historyChart } from './price-history-chart.js';
import { enhanceDropdown } from './dropdown.js';
import { mountProofImage } from './proof-image.js';
import { offerButton } from './price-comparison.js';

function node(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function selector(id, label, options) {
  const field = node('div', 'history-field');
  const caption = node('label', '', label); caption.htmlFor = id;
  const select = node('select', 'history-select');
  select.id = id;
  for (const [value, text] of options) {
    const option = node('option', '', text); option.value = value; select.append(option);
  }
  field.append(caption, select);
  return { field, select };
}
function historyPhoto(item, point, thumbnail = false) {
  const frame = node(thumbnail ? 'span' : 'figure', thumbnail ? 'history-result-photo' : 'history-product-photo');
  if (!point?.proofImageUrl) {
    frame.append(node('span', 'history-photo-missing', 'Photo non archivée'));
    if (thumbnail) frame.setAttribute('aria-hidden', 'true');
    return frame;
  }
  const unit = /^(lb|kg|100g|l)$/i.test(item.unit) ? `/${item.unit}` : '';
  const offer = { name: item.name, storeName: item.storeName, price: `${money(point.price)}${unit} · ${historyDate(point.date, true)}`,
    proofImageUrl: point.proofImageUrl, offerEvidence: { proofCrop: point.proofCrop } };
  const image = thumbnail ? frame : offerButton(offer);
  if (!thumbnail) {
    image.className = 'history-photo-button';
    image.setAttribute('aria-label', `Agrandir la photo de ${historyTitle(item.name)} du ${historyDate(point.date, true)}`);
  }
  mountProofImage(image, offer, 'history-proof-image');
  if (thumbnail) image.setAttribute('aria-hidden', 'true');
  const original = image.querySelector('img');
  if (original) {
    if (!thumbnail) original.loading = 'eager';
    original.addEventListener('error', () => frame.replaceChildren(node('span', 'history-photo-missing', 'Photo indisponible')), { once: true });
  }
  if (!thumbnail) frame.append(image, node('figcaption', '', `Circulaire du ${historyDate(point.date)} · Agrandir`));
  return frame;
}
function showSeries(display, item) {
  display.replaceChildren();
  if (!item) { display.append(node('p', 'list-empty', 'Aucun relevé avec ces filtres. Essaie un autre produit, une autre épicerie ou « Tout l’historique ».')); return; }
  const points = item.points, stats = historyStats(points);
  const unit = /^(lb|kg|100g|l)$/i.test(item.unit) ? `/${item.unit}` : '';
  const overview = node('div', 'history-product-overview'), photo = node('div', 'history-photo-slot'), description = node('div', '');
  description.append(node('h3', 'history-product-title', historyTitle(item.name)),
    node('p', 'history-series-meta', `${item.storeName} · ${historyFormat(item)} · ${historySource(item)}`),
    node('p', 'list-caption', `${points.length} relevés sur ${stats.dates} dates · ${historyDate(points[0].date, true)} au ${historyDate(points.at(-1).date, true)}`));
  overview.append(photo, description); display.append(overview);
  const price = node('div', 'history-latest-price');
  const latest = stats.latest.length > 1 ? `${money(stats.latest[0])} – ${money(stats.latest.at(-1))}${unit}` : `${money(stats.latest[0])}${unit}`;
  price.append(node('span', '', `Prix du ${historyDate(points.at(-1).date, true)}`), node('strong', '', latest));
  display.append(price, historyChart(points, unit, point => photo.replaceChildren(historyPhoto(item, point))));
  display.append(node('p', 'list-caption', points.length === 1 ? 'Un seul relevé conservé pour ce produit, ce format et cette épicerie.' : stats.changed ? 'Sélectionne un point pour voir son prix et l’écart avec le relevé précédent.' : 'Le prix est identique dans tous les relevés de cette série.'));
  if (!item.format && !unit) display.append(node('p', 'list-caption', 'Le format manque dans ces archives : les montants ne prouvent pas une économie à quantité égale.'));
  const detail = node('details', 'history-records');
  detail.append(node('summary', '', `Tous les relevés (${points.length})`));
  const table = node('table', '');
  const header = node('tr', ''); header.append(node('th', '', 'Date'), node('th', '', `Prix${unit}`));
  const head = node('thead', ''); head.append(header); table.append(head);
  const body = node('tbody', '');
  for (const point of points.slice().reverse()) {
    const row = node('tr', ''); row.append(node('td', '', historyDate(point.date, true)), node('td', '', money(point.price))); body.append(row);
  }
  table.append(body); detail.append(table); display.append(detail);
}

// The product comparison also uses this compact historical context. Keep the
// shared entrypoint while the full archive has its own filters and navigation.
export function priceContext(item) {
  const records = item.offerEvidence?.history ?? item.offerEvidence?.observations;
  if (!records?.points?.length) return null;
  const points = records.points.map(point => ({ ...point }));
  const date = item.saleStart?.slice(0, 10);
  if (date && Number(item.currentPrice) > 0 && !points.some(point => point.date === date && point.price === Number(item.currentPrice))) {
    points.push({ date, price: Number(item.currentPrice) });
  }
  points.sort((a, b) => a.date.localeCompare(b.date) || a.price - b.price);
  const section = node('section', 'price-history');
  const unit = /^(lb|kg|100g|l)$/i.test(item.offerEvidence.unit ?? '') ? `/${item.offerEvidence.unit}` : '';
  section.append(node('h3', '', 'Prix observés'), historyChart(points, unit),
    node('p', 'list-caption', `${item.storeName} · ${points.length} relevés · ${historyDate(points[0].date, true)} au ${historyDate(points.at(-1).date, true)}`));
  if (!item.offerEvidence.history) section.append(node('p', 'list-caption', 'Formats anciens non confirmés. Ces écarts ne sont pas comptés dans les économies.'));
  return section;
}

export function setupPriceHistory() {
  const dialog = document.querySelector('#price-history-dialog');
  const content = document.querySelector('#price-history-content');
  const close = document.querySelector('#price-history-close');
  let trigger, catalogue, request = 0;
  let dropdowns = [];
  async function open(items, week, selectedId) {
    dropdowns.forEach(dropdown => dropdown.destroy());
    dropdowns = [];
    const currentRequest = ++request;
    trigger = document.activeElement;
    content.replaceChildren(node('p', 'list-caption', 'Chargement des archives de prix…'));
    dialog.showModal(); close.focus();
    try {
      if (!catalogue) {
        const response = await fetch('./data/price-history.json', { cache: 'no-cache' });
        if (!response.ok) throw new Error('Les archives de prix n’ont pas pu être chargées. Ferme puis réessaie.');
        const data = await response.json();
        if (!Array.isArray(data.series)) throw new Error('Les archives de prix sont invalides.');
        catalogue = flyerHistoryCatalog(data);
      }
      if (!dialog.open || request !== currentRequest) return;
      const data = catalogue;
      content.replaceChildren();
      if (!data.series.length) { content.append(node('p', 'list-empty', 'Aucun relevé archivé disponible.')); return; }
      const coverage = node('div', 'history-coverage');
      const archiveSummary = node('div', 'history-coverage-summary');
      archiveSummary.append(node('strong', '', `${data.observationCount.toLocaleString('fr-CA')} relevés conservés`),
        node('span', '', `${historyDate(data.from, true)} au ${historyDate(data.to, true)}`));
      const count = node('p', 'history-filter-count'); count.setAttribute('role', 'status');
      coverage.append(archiveSummary, count);
      content.append(coverage);
      const searchLabel = node('label', 'history-field history-search-field', 'Rechercher dans toutes les archives');
      const search = node('input', 'history-select'); search.id = 'history-search'; search.type = 'search'; search.placeholder = 'Céleri, fraises, beurre…';
      searchLabel.append(search); content.append(searchLabel);
      const stores = selector('history-store', 'Épicerie', [['', 'Toutes les épiceries'], ...[...new Map(data.series.map(item => [item.storeId, item.storeName]))].sort((a, b) => a[1].localeCompare(b[1], 'fr'))]);
      const period = selector('history-period', 'Période', [['all', 'Tout l’historique'], ['6', '6 derniers mois'], ['3', '3 derniers mois'], ['1', 'Dernier mois']]);
      const sort = selector('history-sort', 'Trier', [['records', 'Le plus de relevés'], ['recent', 'Relevés les plus récents'], ['name', 'Nom du produit']]);
      const changed = node('button', 'list-action history-change-filter', 'Prix qui varient'); changed.type = 'button'; changed.setAttribute('aria-pressed', 'true');
      const controls = node('div', 'history-controls'); controls.append(stores.field, period.field, sort.field, changed); content.append(controls);
      const workspace = node('div', 'history-workspace');
      const sidebar = node('div', 'history-sidebar');
      const results = node('div', 'history-results'); results.setAttribute('aria-label', 'Produits archivés');
      const pages = node('div', 'history-pagination');
      const previous = node('button', 'list-action', 'Précédent'), next = node('button', 'list-action', 'Suivant'), pageLabel = node('span', 'list-caption');
      previous.type = next.type = 'button'; previous.setAttribute('aria-label', 'Page de résultats précédente'); next.setAttribute('aria-label', 'Page de résultats suivante');
      pages.append(previous, pageLabel, next); sidebar.append(results, pages);
      const display = node('section', 'history-display'); display.setAttribute('aria-label', 'Historique du produit');
      workspace.append(sidebar, display); content.append(workspace);
      const chosen = items.find(item => item.id === selectedId);
      if (chosen) { search.value = historyTitle(chosen.name); stores.select.value = chosen.storeId; }
      let filtered = [], selected, page = 0;
      const pageSize = 12;
      function renderResults() {
        results.replaceChildren();
        for (const item of filtered.slice(page * pageSize, (page + 1) * pageSize)) {
          const button = node('button', 'history-result'); button.type = 'button';
          button.setAttribute('aria-pressed', String(item.id === selected));
          const copy = node('span', 'history-result-copy');
          copy.append(node('strong', '', historyTitle(item.name)), node('span', '', `${item.storeName} · ${historyFormat(item)}`),
            node('small', '', `${item.points.length} relevé${item.points.length > 1 ? 's' : ''} · ${historySource(item)}`));
          button.append(historyPhoto(item, item.points.findLast(point => point.proofImageUrl), true), copy);
          button.addEventListener('click', () => {
            selected = item.id;
            for (const control of results.children) control.setAttribute('aria-pressed', String(control === button));
            showSeries(display, item);
            if (window.matchMedia('(max-width: 700px)').matches) display.scrollIntoView({ block: 'start', behavior: 'instant' });
          }); results.append(button);
        }
        previous.disabled = page === 0; next.disabled = (page + 1) * pageSize >= filtered.length;
        pageLabel.textContent = filtered.length ? `${page + 1} / ${Math.ceil(filtered.length / pageSize)}` : '0 résultat';
      }
      function filter() {
        filtered = filterHistory(data.series, { query: search.value, store: stores.select.value,
          months: period.select.value, sort: sort.select.value, changed: changed.getAttribute('aria-pressed') === 'true', endDate: data.to });
        if (!filtered.some(item => item.id === selected)) selected = filtered[0]?.id;
        page = Math.max(0, Math.floor(filtered.findIndex(item => item.id === selected) / pageSize));
        const records = filtered.reduce((total, item) => total + item.points.length, 0);
        count.textContent = `${filtered.length.toLocaleString('fr-CA')} résultat${filtered.length > 1 ? 's' : ''} · ${records.toLocaleString('fr-CA')} relevés`;
        renderResults(); showSeries(display, filtered.find(item => item.id === selected));
      }
      previous.addEventListener('click', () => { page--; renderResults(); });
      next.addEventListener('click', () => { page++; renderResults(); });
      changed.addEventListener('click', () => { changed.setAttribute('aria-pressed', String(changed.getAttribute('aria-pressed') !== 'true')); filter(); });
      search.addEventListener('input', filter);
      for (const control of [stores, period, sort]) control.select.addEventListener('change', filter);
      filter();
      dropdowns = [stores, period, sort].map(control => enhanceDropdown(control.select));
    } catch (error) {
      if (dialog.open && request === currentRequest) content.replaceChildren(node('p', 'list-empty', error.message));
    }
  }
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    dropdowns.forEach(dropdown => dropdown.destroy());
    dropdowns = [];
    if (trigger?.isConnected) trigger.focus();
  });
  return { open };
}
