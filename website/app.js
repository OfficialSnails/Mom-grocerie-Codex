const state = {
  weeks: [],
  week: null,
  selected: new Map(),
  activeCategoryId: '',
  activeStoreId: '',
  searchQuery: '',
};

const els = {
  weekToggle: document.querySelector('#week-toggle'),
  weekLabel: document.querySelector('#week-label'),
  weekOptions: document.querySelector('#week-options'),
  weekHeader: document.querySelector('#week-header'),
  methodNote: document.querySelector('#method-note'),
  methodNoteBody: document.querySelector('#method-note-body'),
  categoryTabs: document.querySelector('#category-tabs'),
  searchInput: document.querySelector('#item-search'),
  storeFilter: document.querySelector('#store-filter'),
  items: document.querySelector('#items'),
  selectionSummary: document.querySelector('#selection-summary'),
  selectionList: document.querySelector('#selection-list'),
  exportStatus: document.querySelector('#export-status'),
  printButton: document.querySelector('#print-button'),
  clearButton: document.querySelector('#clear-button'),
  emptyTemplate: document.querySelector('#empty-template'),
};

function moneySafe(text) {
  return text || '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function itemSearchText(item) {
  return normalizeText([
    item.name,
    item.storeName,
    item.price,
    item.scale,
    item.reason,
    ...(item.comparisons ?? []),
  ].join(' '));
}

function selectionKey() {
  return state.week ? `bons-speciaux:selected:${state.week.slug}` : '';
}

function loadSelection() {
  state.selected.clear();
  const key = selectionKey();
  if (!key) return;
  const raw = localStorage.getItem(key);
  if (!raw) return;
  try {
    const ids = JSON.parse(raw);
    const allItems = allWeekItems();
    for (const id of ids) {
      const item = allItems.find(candidate => candidate.id === id);
      if (item) state.selected.set(id, item);
    }
  } catch {
    state.selected.clear();
  }
}

function saveSelection() {
  const key = selectionKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify([...state.selected.keys()]));
}

function allWeekItems() {
  return state.week?.categories.flatMap(category => category.items) ?? [];
}

function allWeekStores() {
  if (!state.week) return [];
  const stores = new Map();
  for (const item of allWeekItems()) {
    if (!stores.has(item.storeId)) {
      stores.set(item.storeId, {
        id: item.storeId,
        name: item.storeName,
        count: 0,
      });
    }
    stores.get(item.storeId).count += 1;
  }
  return [...stores.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Impossible de charger ${path}`);
  return response.json();
}

function renderWeeks() {
  els.weekOptions.innerHTML = '';
  els.weekLabel.textContent = state.week ? `${state.week.folderName} · ${state.week.itemCount} bons prix` : 'Choisir une semaine';
  for (const week of state.weeks) {
    const option = document.createElement('button');
    option.type = 'button';
    option.role = 'option';
    option.className = state.week?.slug === week.slug ? 'active' : '';
    option.setAttribute('aria-selected', state.week?.slug === week.slug ? 'true' : 'false');
    option.textContent = `${week.folderName} · ${week.itemCount} bons prix`;
    option.addEventListener('click', () => {
      closeWeekMenu();
      void selectWeek(week);
    });
    els.weekOptions.append(option);
  }
}

function closeWeekMenu() {
  els.weekOptions.hidden = true;
  els.weekToggle.setAttribute('aria-expanded', 'false');
}

function toggleWeekMenu() {
  const willOpen = els.weekOptions.hidden;
  els.weekOptions.hidden = !willOpen;
  els.weekToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}

function renderWeekHeader() {
  if (!state.week) {
    els.weekHeader.innerHTML = '<h2>Aucune semaine disponible</h2><p>Génère un rapport hebdomadaire pour alimenter le site.</p>';
    return;
  }

  els.weekHeader.innerHTML = `
    <div class="week-header-main">
      <div class="week-title">
        <p class="eyebrow">Semaine active</p>
        <h2>${escapeHtml(state.week.title)}</h2>
      </div>
      <div class="week-meta" aria-label="Résumé de la semaine">
        <span class="pill"><strong>${state.week.itemCount}</strong> bons prix</span>
        <span class="pill"><strong>${state.week.stores.length}</strong> épiceries</span>
        <span class="pill">${escapeHtml(state.week.weekRange)}</span>
        <span class="pill basket-pill"><strong>${state.selected.size}</strong> dans le panier</span>
      </div>
    </div>
  `;
}

function renderMethodNote() {
  if (!state.week || !els.methodNoteBody) {
    if (els.methodNoteBody) els.methodNoteBody.innerHTML = '';
    return;
  }

  els.methodNoteBody.innerHTML = `
    <span>Les prix viennent des circulaires de Joliette et sont en dollars canadiens.</span>
    <span>Chaque rayon garde les meilleurs choix trouvés cette semaine; s'il y en a peu, c'est qu'on n'a pas ajouté de faux rabais pour remplir.</span>
    <span>Quand le format n'est pas certain, la photo reste là pour vérifier rapidement.</span>
  `;
}

function renderCategoryTabs() {
  els.categoryTabs.innerHTML = '';
  if (!state.week) return;
  for (const category of state.week.categories) {
    const selectedCount = category.items.filter(item => state.selected.has(item.id)).length;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = !state.activeStoreId && state.activeCategoryId === category.id ? 'active' : '';
    button.innerHTML = `
      <span class="category-name"><span aria-hidden="true">${escapeHtml(category.emoji)}</span>${escapeHtml(category.title)}</span>
      <span class="category-count">${selectedCount > 0 ? `${selectedCount}/` : ''}${category.items.length}</span>
    `;
    button.addEventListener('click', () => {
      state.activeCategoryId = category.id;
      state.activeStoreId = '';
      state.searchQuery = '';
      els.storeFilter.value = '';
      els.searchInput.value = '';
      renderCategoryTabs();
      renderItems();
    });
    els.categoryTabs.append(button);
  }
}

function renderStoreFilter() {
  if (!els.storeFilter) return;
  els.storeFilter.innerHTML = '<option value="">Toutes les épiceries</option>';
  for (const store of allWeekStores()) {
    const option = document.createElement('option');
    option.value = store.id;
    option.textContent = `${store.name} · ${store.count} item${store.count > 1 ? 's' : ''}`;
    option.selected = state.activeStoreId === store.id;
    els.storeFilter.append(option);
  }
}

function itemDetails(item) {
  const rows = [
    item.scale ? `⚖️ ${escapeHtml(item.scale)}` : '',
    item.reason ? `✅ <strong>Pourquoi:</strong> ${escapeHtml(item.reason)}` : '',
    ...(item.comparisons ?? []).map(escapeHtml),
  ].filter(Boolean);

  return rows.map(row => `<li>${row}</li>`).join('');
}

function renderItemCard(item) {
  const selected = state.selected.has(item.id);
  const card = document.createElement('article');
  card.className = `item-card ${selected ? 'selected' : ''}`;
  card.innerHTML = `
    <div class="product-media">
      ${item.proofImageUrl ? `<img class="proof" src="${escapeHtml(item.proofImageUrl)}" alt="Preuve prix ${escapeHtml(item.name)}" width="520" height="360" loading="lazy" />` : '<div class="proof-missing"><span>Image non disponible</span><small>Le prix reste vérifié par les données de la semaine.</small></div>'}
      <span class="media-store">${escapeHtml(item.storeName)}</span>
    </div>
    <div class="product-body">
      <div class="product-main">
        <span class="item-main">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <span class="store-line">📍 ${escapeHtml(item.storeName)}</span>
        </span>
        <span class="price-stack" translate="no">
          <span class="price">${escapeHtml(moneySafe(item.price))}</span>
        </span>
      </div>
      <ul class="detail-list">${itemDetails(item)}</ul>
      <label class="add-control">
        <input type="checkbox" ${selected ? 'checked' : ''} aria-label="Choisir ${escapeHtml(item.name)}" />
        <span>${selected ? 'Ajouté au panier' : 'Ajouter'}</span>
      </label>
    </div>
  `;
  card.querySelector('input').addEventListener('change', event => {
    if (event.target.checked) {
      state.selected.set(item.id, item);
    } else {
      state.selected.delete(item.id);
    }
    saveSelection();
    renderWeekHeader();
    renderCategoryTabs();
    renderItems();
    renderSelection();
  });
  return card;
}

function renderItems() {
  els.items.innerHTML = '';
  if (!state.week) return;

  const query = normalizeText(state.searchQuery.trim());
  const category = state.week.categories.find(candidate => candidate.id === state.activeCategoryId) ?? state.week.categories[0];
  const activeStore = allWeekStores().find(store => store.id === state.activeStoreId);
  if (!category && !activeStore) return;
  if (!state.activeStoreId) state.activeCategoryId = category.id;

  const baseItems = query
    ? allWeekItems().filter(item => !state.activeStoreId || item.storeId === state.activeStoreId)
    : state.activeStoreId
      ? allWeekItems().filter(item => item.storeId === state.activeStoreId)
      : category.items;
  const sourceItems = query ? baseItems.filter(item => itemSearchText(item).includes(query)) : baseItems;
  const section = document.createElement('section');
  section.className = 'category';
  section.id = `category-${query ? 'search' : state.activeStoreId ? `store-${state.activeStoreId}` : category.id}`;
  const titleLabel = state.activeStoreId ? 'Épicerie' : query ? 'Recherche' : 'Rayon';
  const titleIcon = state.activeStoreId ? '📍' : query ? '⌕' : escapeHtml(category.emoji);
  const titleText = state.activeStoreId
    ? escapeHtml(activeStore?.name ?? 'Épicerie')
    : query
      ? `Résultats pour “${escapeHtml(state.searchQuery.trim())}”`
      : escapeHtml(category.title);
  section.innerHTML = `
    <div class="category-title">
      <div>
        <p class="eyebrow">${titleLabel}</p>
        <h2><span>${titleIcon}</span>${titleText}</h2>
      </div>
      <span>${sourceItems.length} option${sourceItems.length > 1 ? 's' : ''}</span>
    </div>
  `;

  if (query && sourceItems.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state search-empty';
    empty.innerHTML = '<p>Aucun résultat.</p><span>Essaie un mot plus simple ou choisis une autre épicerie.</span>';
    section.append(empty);
    els.items.append(section);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'items-grid';

  for (const item of sourceItems) {
    grid.append(renderItemCard(item));
  }

  section.append(grid);
  els.items.append(section);
}

function groupSelectedByStore() {
  const stores = new Map();
  for (const item of state.selected.values()) {
    if (!stores.has(item.storeId)) {
      stores.set(item.storeId, {
        id: item.storeId,
        name: item.storeName,
        address: item.storeAddress,
        items: [],
      });
    }
    stores.get(item.storeId).items.push(item);
  }
  return [...stores.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

function renderSelection() {
  const count = state.selected.size;
  els.selectionSummary.textContent = count === 0 ? 'Aucun item sélectionné' : `${count} item${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}`;
  els.selectionList.innerHTML = '';

  if (count === 0) {
    return;
  }

  for (const store of groupSelectedByStore()) {
    const block = document.createElement('section');
    block.className = 'store-block';
    block.innerHTML = `
      <h3>${escapeHtml(store.name)}</h3>
      ${store.address ? `<div class="store-address">${escapeHtml(store.address)}</div>` : ''}
    `;

    for (const item of store.items) {
      const row = document.createElement('div');
      row.className = 'selected-item';
      row.innerHTML = `
        <span>
          <strong>${escapeHtml(item.name)}</strong>
          <small translate="no">${escapeHtml(item.price)}</small>
        </span>
        <button type="button" aria-label="Retirer ${escapeHtml(item.name)}">Retirer</button>
      `;
      row.querySelector('button').addEventListener('click', () => {
        state.selected.delete(item.id);
        saveSelection();
        renderWeekHeader();
        renderCategoryTabs();
        renderItems();
        renderSelection();
      });
      block.append(row);
    }

    els.selectionList.append(block);
  }
}

function setExportStatus(message, tone = '') {
  els.exportStatus.textContent = message;
  els.exportStatus.className = `export-status ${tone}`.trim();
}

function slugFileName(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'liste-epicerie';
}

function buildPrintableHtml(selectedItems) {
  const stores = groupSelectedByStore();
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
            <th>Item</th>
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
        </tbody>
      </table>
    </section>
  `).join('');

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(state.week?.title || 'Liste d’épicerie')}</title>
  <style>
    @page { size: letter; margin: 0.55in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #171714;
      background: #fffefa;
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
      grid-template-columns: repeat(3, 1fr);
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
    td.price {
      width: 115px;
      color: #171714;
      font-weight: 900;
      white-space: nowrap;
    }
    @media screen {
      body {
        max-width: 8.5in;
        margin: 24px auto;
        padding: 0.55in;
        box-shadow: 0 18px 48px rgba(38, 31, 18, 0.14);
      }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Liste d'épicerie</h1>
      <div>${escapeHtml(state.week?.weekRange || state.week?.folderName || '')}</div>
    </div>
    <div class="meta">
      ${escapeHtml(selectedItems.length)} item${selectedItems.length > 1 ? 's' : ''}<br />
      ${escapeHtml(stores.length)} épicerie${stores.length > 1 ? 's' : ''}<br />
      Généré le ${escapeHtml(generated)}
    </div>
  </header>
  <div class="summary">
    <div>${escapeHtml(selectedItems.length)} item${selectedItems.length > 1 ? 's' : ''} choisi${selectedItems.length > 1 ? 's' : ''}</div>
    <div>${escapeHtml(stores.length)} arrêt${stores.length > 1 ? 's' : ''}</div>
    <div>Prix en CAD</div>
  </div>
  ${storeBlocks}
</body>
</html>`;
}

function fileNameForCurrentWeek(extension) {
  return `${slugFileName(state.week?.title || 'liste-epicerie')}.${extension}`;
}

async function loadJsPdf() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;

  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = resolve;
    script.onerror = () => reject(new Error('PDF library unavailable'));
    document.head.append(script);
  });

  if (!window.jspdf?.jsPDF) throw new Error('PDF library unavailable');
  return window.jspdf.jsPDF;
}

async function downloadBrowserPdf() {
  const selectedItems = [...state.selected.values()];
  const stores = groupSelectedByStore();
  const jsPDF = await loadJsPdf();
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 44;
  const tableWidth = pageWidth - margin * 2;
  const priceWidth = 92;
  const itemWidth = tableWidth - priceWidth;
  let y = margin;

  function addPageIfNeeded(requiredHeight = 28) {
    if (y + requiredHeight <= pageHeight - margin) return;
    pdf.addPage();
    y = margin;
  }

  function text(value, x, yPos, options = {}) {
    pdf.setFont(options.font || 'helvetica', options.style || 'normal');
    pdf.setFontSize(options.size || 11);
    pdf.setTextColor(...(options.color || [23, 23, 20]));
    pdf.text(String(value), x, yPos, options.align ? { align: options.align } : undefined);
  }

  function line(yPos, color = [34, 88, 69], width = 1) {
    pdf.setDrawColor(...color);
    pdf.setLineWidth(width);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
  }

  text('Liste d’épicerie', margin, y + 10, { font: 'times', style: 'bold', size: 30 });
  text(state.week?.weekRange || state.week?.folderName || '', margin, y + 34, { size: 12, color: [95, 90, 80] });
  text(`${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''}`, pageWidth - margin, y + 8, { size: 11, color: [95, 90, 80], align: 'right' });
  text(`${stores.length} épicerie${stores.length > 1 ? 's' : ''}`, pageWidth - margin, y + 25, { size: 11, color: [95, 90, 80], align: 'right' });
  text('Prix en CAD', pageWidth - margin, y + 42, { size: 11, color: [95, 90, 80], align: 'right' });
  y += 64;
  line(y, [23, 23, 20], 1.8);
  y += 28;

  for (const store of stores) {
    addPageIfNeeded(76);
    text(store.name, margin, y, { font: 'times', style: 'bold', size: 20 });
    y += 16;
    if (store.address) {
      text(store.address, margin, y, { size: 11, color: [95, 90, 80] });
      y += 14;
    }
    y += 8;

    pdf.setFillColor(35, 88, 69);
    pdf.rect(margin, y, tableWidth, 24, 'F');
    text('ITEM', margin + 10, y + 16, { style: 'bold', size: 9, color: [255, 255, 255] });
    text('PRIX', margin + itemWidth + 10, y + 16, { style: 'bold', size: 9, color: [255, 255, 255] });
    y += 24;

    for (const item of store.items) {
      const itemLines = pdf.splitTextToSize(item.name, itemWidth - 18);
      const rowHeight = Math.max(28, itemLines.length * 12 + 16);
      addPageIfNeeded(rowHeight + 8);
      pdf.setDrawColor(231, 223, 209);
      pdf.setLineWidth(0.8);
      pdf.rect(margin, y, tableWidth, rowHeight);
      text(itemLines, margin + 10, y + 17, { size: 11 });
      text(item.price, margin + itemWidth + 10, y + 17, { style: 'bold', size: 12, color: [35, 88, 69] });
      y += rowHeight;
    }
    y += 22;
  }

  pdf.save(fileNameForCurrentWeek('pdf'));
  setExportStatus(`PDF téléchargé: ${fileNameForCurrentWeek('pdf')}`, 'success');
}

function openBrowserPrintExport() {
  const selectedItems = [...state.selected.values()];
  const html = buildPrintableHtml(selectedItems);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    setExportStatus('Le navigateur a bloqué l’impression. Autorise les fenêtres contextuelles ou réessaie.', 'warning');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
  setExportStatus('Fenêtre d’impression ouverte. Choisis ton imprimante ou “Enregistrer en PDF”.', 'success');
}

async function exportPdfToDesktop() {
  if (!state.week) return;
  const selectedIds = [...state.selected.keys()];
  if (selectedIds.length === 0) {
    setExportStatus('Ajoute au moins un item avant de créer le PDF.', 'warning');
    return;
  }

  const originalLabel = els.printButton.textContent;
  els.printButton.disabled = true;
  els.printButton.textContent = 'Création...';
  setExportStatus('Préparation de la liste...', '');

  const canUseLocalPdfEndpoint = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  try {
    if (!canUseLocalPdfEndpoint) {
      await downloadBrowserPdf();
      return;
    }

    const response = await fetch('/api/export-pdf', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        weekSlug: state.week.slug,
        selectedIds,
      }),
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Export local indisponible');
    }
    const text = await response.text();
    const result = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(result.error || 'Export impossible');
    setExportStatus(`PDF sauvegardé: ${result.fileName}`, 'success');
  } catch (err) {
    openBrowserPrintExport();
  } finally {
    els.printButton.disabled = false;
    els.printButton.textContent = originalLabel;
  }
}

async function selectWeek(weekMeta) {
  state.week = await loadJson(weekMeta.path);
  loadSelection();
  state.activeCategoryId = state.week.categories[0]?.id ?? '';
  state.activeStoreId = '';
  state.searchQuery = '';
  els.searchInput.value = '';
  if (els.storeFilter) els.storeFilter.value = '';
  renderWeeks();
  renderWeekHeader();
  renderMethodNote();
  renderStoreFilter();
  renderCategoryTabs();
  renderItems();
  renderSelection();
}

async function init() {
  try {
    const index = await loadJson('data/weeks/index.json');
    state.weeks = index.weeks ?? [];
    if (state.weeks.length > 0) {
      await selectWeek(state.weeks[0]);
    } else {
      renderWeeks();
      renderWeekHeader();
      renderMethodNote();
      renderStoreFilter();
      renderSelection();
    }
  } catch (err) {
    els.weekHeader.innerHTML = `<h2>Site non alimenté</h2><p>${err.message}</p>`;
    renderSelection();
  }
}

els.printButton.addEventListener('click', exportPdfToDesktop);
els.weekToggle.addEventListener('click', toggleWeekMenu);
document.addEventListener('click', event => {
  if (!event.target.closest('.week-field')) closeWeekMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeWeekMenu();
});
els.searchInput.addEventListener('input', event => {
  state.searchQuery = event.target.value;
  renderItems();
});
els.storeFilter.addEventListener('change', event => {
  state.activeStoreId = event.target.value;
  if (state.activeStoreId) {
    state.activeCategoryId = '';
  } else {
    state.activeCategoryId = state.week?.categories[0]?.id ?? '';
  }
  renderCategoryTabs();
  renderItems();
});
els.clearButton.addEventListener('click', () => {
  state.selected.clear();
  saveSelection();
  setExportStatus('');
  renderWeekHeader();
  renderCategoryTabs();
  renderItems();
  renderSelection();
});

init();
