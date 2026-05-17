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

  const baseItems = state.activeStoreId
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
  setExportStatus('Création du PDF sur le bureau...', '');

  try {
    const response = await fetch('/api/export-pdf', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        weekSlug: state.week.slug,
        selectedIds,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Export impossible');
    setExportStatus(`PDF sauvegardé: ${result.fileName}`, 'success');
  } catch (err) {
    setExportStatus(`${err.message}. Vérifie que le serveur local est ouvert avec npm run web.`, 'warning');
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
