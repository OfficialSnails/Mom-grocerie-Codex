const state = {
  weeks: [],
  week: null,
  selected: new Map(),
  activeCategoryId: 'all',
  selectedStoreIds: new Set(),
  searchQuery: '',
  mode: 'deals',
  notes: '',
};

const ALL_CATEGORY = {
  id: 'all',
  title: 'Tous',
  emoji: '🛒',
  items: [],
  virtual: true,
};

const OPTIONAL_STORE_IDS = new Set(['costco-quebec']);

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
  regularStoresButton: document.querySelector('#regular-stores-button'),
  allStoresButton: document.querySelector('#all-stores-button'),
  clearStoresButton: document.querySelector('#clear-stores-button'),
  modeTabs: document.querySelector('#mode-tabs'),
  items: document.querySelector('#items'),
  selectionSummary: document.querySelector('#selection-summary'),
  selectionEstimate: document.querySelector('#selection-estimate'),
  selectionList: document.querySelector('#selection-list'),
  notesInput: document.querySelector('#list-notes'),
  exportStatus: document.querySelector('#export-status'),
  printButton: document.querySelector('#print-button'),
  clearButton: document.querySelector('#clear-button'),
  emptyTemplate: document.querySelector('#empty-template'),
};

let exportStatusTimer = null;

function moneySafe(text) {
  return text || '';
}

const VARIABLE_PRICE_UNITS = new Set(['kg', 'lb', 'lbs', '100g', 'l', 'litre', 'litres']);
const VARIABLE_PRICE_PATTERN = /\/\s*(?:kg|lb|lbs|100\s*g|g|l|litre|litres)\b/i;

function isVariablePrice(item) {
  const unit = String(item.unit ?? '').trim().toLowerCase();
  return VARIABLE_PRICE_UNITS.has(unit) || VARIABLE_PRICE_PATTERN.test(String(item.price ?? ''));
}

function parseDisplayPrice(price) {
  const text = String(price ?? '');
  const multi = text.match(/\b\d+\s*(?:pour|for|\/)\s*\$?\s*(\d+(?:[,.]\d{1,2})?)/i);
  const match = multi ?? text.match(/(\d+(?:[,.]\d{1,2})?)/);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0 || value > 1000) return null;
  return value;
}

function estimateItemPrice(item) {
  if (isVariablePrice(item)) return null;
  if (typeof item.currentPrice === 'number' && Number.isFinite(item.currentPrice) && item.currentPrice > 0) {
    return item.currentPrice;
  }
  return parseDisplayPrice(item.price);
}

function estimateBasketTotal(items) {
  const estimate = {
    subtotal: 0,
    fixedCount: 0,
    variableCount: 0,
    unknownCount: 0,
    totalCount: 0,
  };

  for (const item of items) {
    estimate.totalCount += 1;
    if (isVariablePrice(item)) {
      estimate.variableCount += 1;
      continue;
    }

    const price = estimateItemPrice(item);
    if (price == null) {
      estimate.unknownCount += 1;
      continue;
    }

    estimate.fixedCount += 1;
    estimate.subtotal += price;
  }

  return estimate;
}

function formatEstimateCad(value) {
  return `${(Math.round(value * 100) / 100).toFixed(2).replace('.', ',')} $`;
}

function estimateCaveat(estimate) {
  const parts = [];
  if (estimate.variableCount > 0) {
    parts.push(`${estimate.variableCount} produit${estimate.variableCount > 1 ? 's' : ''} au poids ou au format variable`);
  }
  if (estimate.unknownCount > 0) {
    parts.push(`${estimate.unknownCount} prix à vérifier`);
  }
  return parts.length > 0 ? `+ ${parts.join(' + ')} non inclus.` : '';
}

function renderEstimateSummary(items) {
  const estimate = estimateBasketTotal(items);
  const caveat = estimateCaveat(estimate);
  return `
    <div class="estimate-total">
      <span>Total estimé</span>
      <strong translate="no">${escapeHtml(formatEstimateCad(estimate.subtotal))}</strong>
    </div>
    <p>Avant taxes, dépôts, quantités réelles et prix au poids.${caveat ? ` ${escapeHtml(caveat)}` : ''}</p>
  `;
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

function notesKey() {
  return state.week ? `bons-speciaux:notes:${state.week.slug}` : '';
}

function currentCategories() {
  if (!state.week) return [];
  if (state.mode === 'all') return state.week.allCategories ?? state.week.categories ?? [];
  return state.week.dealCategories ?? state.week.categories ?? [];
}

function categoryLabel(category) {
  if (category.id === 'pantry') return 'Garde-manger et autres';
  return category.title;
}

function displayStoreName(storeId, fallbackName) {
  const canonicalId = canonicalStoreId(storeId);
  const names = {
    'metro-joliette': 'Metro',
    'maxi-joliette': 'Maxi',
    'iga-joliette': 'IGA',
    'superc-joliette': 'Super C',
    'bonichoix-joliette': 'BoniChoix',
    'intermarche-joliette': "L'Inter-Marché",
    'tradition-joliette': 'Marchés Tradition',
    'familiprix-joliette': 'Familiprix',
    'costco-quebec': 'Costco',
  };
  return names[canonicalId] ?? String(fallbackName ?? '').replace(/\s+Joliette\b/i, '').trim();
}

function canonicalStoreId(storeId) {
  if (storeId === 'bonichoix-stemilie') return 'bonichoix-joliette';
  return storeId;
}

const COSTCO_NON_GROCERY_KEYWORDS = [
  'adidas', 'puma', 'reebok', 'calvin klein', 'bench', 'eddie bauer',
  'chandail', 't-shirt', 'tee-shirt', 'chemise', 'pantalon', 'jeans', 'legging', 'short',
  'robe', 'jupe', 'manteau', 'veste', 'hoodie', 'pull', 'pyjama', 'chaussette', 'bas',
  'soulier', 'souliers', 'chaussure', 'chaussures', 'sandale', 'bottes', 'maillot',
  'sac a dos', 'sac à dos', 'valise', 'bijou', 'bijoux', 'montre', 'lunettes',
  'matelas', 'oreiller', 'couette', 'drap', 'literie', 'serviette de plage',
  'divan', 'fauteuil', 'meuble', 'table pliante', 'chaise', 'bibliotheque',
  'ventilateur', 'fan', 'climatiseur', 'chauffage', 'lampe', 'lumiere', 'lumière',
  'televiseur', 'téléviseur', 'moniteur', 'ecran', 'écran', 'ordinateur', 'laptop',
  'haut-parleur', 'speaker', 'ecouteur', 'écouteur', 'camera', 'caméra',
  'chargeur', 'batterie', 'imprimante', 'projecteur', 'aspirateur',
  'appareil photo', 'barbecue', 'bbq', 'outil', 'outils', 'perceuse', 'scie',
  'tondeuse', 'kayak', 'velo', 'vélo', 'pneu', 'pneus', 'piscine', 'jouet', 'jouets',
  'decoration', 'décoration', 'decor', 'décor', 'jardiniere', 'jardinière',
];

function isCostcoGroceryRelevantItem(item) {
  if (canonicalStoreId(item?.storeId) !== 'costco-quebec') return true;
  const text = normalizeText([
    item.name,
    item.normalizedName,
    item.categoryTitle,
    item.price,
    item.scale,
  ].join(' '));
  return !COSTCO_NON_GROCERY_KEYWORDS.some(keyword => text.includes(normalizeText(keyword)));
}

function isShopperVisibleItem(item) {
  return isCostcoGroceryRelevantItem(item);
}

function displayCategories() {
  if (!state.week) return [];
  return [ALL_CATEGORY, ...currentCategories()];
}

function allSelectableItems() {
  if (!state.week) return [];
  const seen = new Map();
  for (const category of [...(state.week.dealCategories ?? state.week.categories ?? []), ...(state.week.allCategories ?? [])]) {
    for (const item of category.items ?? []) {
      if (!isShopperVisibleItem(item)) continue;
      if (!seen.has(item.id)) seen.set(item.id, item);
    }
  }
  return [...seen.values()];
}

function loadSelection() {
  state.selected.clear();
  const key = selectionKey();
  if (!key) return;
  const raw = localStorage.getItem(key);
  if (!raw) return;
  try {
    const ids = JSON.parse(raw);
    const allItems = allSelectableItems();
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

function loadNotes() {
  const key = notesKey();
  state.notes = key ? localStorage.getItem(key) ?? '' : '';
  if (els.notesInput) els.notesInput.value = state.notes;
}

function saveNotes() {
  const key = notesKey();
  if (!key) return;
  localStorage.setItem(key, state.notes);
}

function allWeekItems() {
  return (currentCategories().flatMap(category => category.items) ?? []).filter(isShopperVisibleItem);
}

function regularStoreIds(stores = allWeekStores()) {
  return stores.filter(store => !OPTIONAL_STORE_IDS.has(store.id)).map(store => store.id);
}

function defaultStoreSelection(stores = allWeekStores()) {
  const regularIds = regularStoreIds(stores);
  return new Set(regularIds.length > 0 ? regularIds : stores.map(store => store.id));
}

function allStoreSelection(stores = allWeekStores()) {
  return new Set(stores.map(store => store.id));
}

function ensureSelectedStores() {
  const stores = allWeekStores();
  const validIds = new Set(stores.map(store => store.id));
  for (const storeId of [...state.selectedStoreIds]) {
    if (!validIds.has(storeId)) state.selectedStoreIds.delete(storeId);
  }
}

function itemMatchesSelectedStores(item) {
  return state.selectedStoreIds.has(canonicalStoreId(item.storeId));
}

function categoryItems(category) {
  if (category?.id === 'all') {
    const items = allWeekItems();
    return items.filter(itemMatchesSelectedStores);
  }
  const items = (category?.items ?? []).filter(isShopperVisibleItem);
  return items.filter(itemMatchesSelectedStores);
}

function allWeekStores() {
  if (!state.week) return [];
  const stores = new Map();
  for (const item of allWeekItems()) {
    const storeId = canonicalStoreId(item.storeId);
    if (!stores.has(storeId)) {
      stores.set(storeId, {
        id: storeId,
        name: displayStoreName(storeId, item.storeName),
        count: 0,
      });
    }
    stores.get(storeId).count += 1;
  }
  return [...stores.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

function showAllWeeks() {
  const params = new URLSearchParams(window.location.search);
  return params.get('debugWeeks') === '1' || localStorage.getItem('bons-speciaux:show-all-weeks') === '1';
}

function isProductionWeek(week) {
  const text = normalizeText([week.slug, week.folderName, week.title, week.path].join(' '));
  return !/(manual-preview|preview|test|debug|sample|mock|demo)/.test(text);
}

function visibleWeeks(weeks) {
  const productionWeeks = weeks.filter(isProductionWeek);
  if (showAllWeeks()) return productionWeeks;
  return productionWeeks.slice(0, 1);
}

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Impossible de charger ${path}`);
  return response.json();
}

function renderWeeks() {
  els.weekOptions.innerHTML = '';
  els.weekLabel.textContent = state.week ? `${state.week.folderName} · ${state.week.itemCount} bons prix` : 'Choisir une semaine';
  for (const week of visibleWeeks(state.weeks)) {
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
        <span class="pill"><strong>${state.week.allItemCount ?? state.week.itemCount}</strong> produits trouvés</span>
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
    <span>Les prix viennent des circulaires du Québec et sont en dollars canadiens.</span>
    <span>Chaque rayon garde les meilleurs choix trouvés cette semaine; s'il y en a peu, c'est qu'on n'a pas ajouté de faux rabais pour remplir.</span>
    <span>Quand le format n'est pas certain, la photo reste là pour vérifier rapidement.</span>
    <span>Costco peut afficher des prix membre, des formats en vrac et des périodes de circulaire plus longues.</span>
    <span>Les rayons sont classés automatiquement; certains produits peuvent parfois être approximatifs.</span>
  `;
}

function renderCategoryTabs() {
  els.categoryTabs.innerHTML = '';
  if (!state.week) return;
  for (const category of displayCategories()) {
    const scopedItems = categoryItems(category);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = state.activeCategoryId === category.id ? 'active' : '';
    button.innerHTML = `
      <span class="category-name"><span aria-hidden="true">${escapeHtml(category.emoji)}</span>${escapeHtml(categoryLabel(category))}</span>
      <span class="category-count">${scopedItems.length}</span>
    `;
    button.addEventListener('click', () => {
      state.activeCategoryId = category.id;
      state.searchQuery = '';
      els.searchInput.value = '';
      renderCategoryTabs();
      renderItems();
    });
    els.categoryTabs.append(button);
  }
}

function renderStoreFilter() {
  if (!els.storeFilter) return;
  ensureSelectedStores();
  els.storeFilter.innerHTML = '';
  const stores = allWeekStores();
  const regularIds = regularStoreIds(stores);
  const regularSelectionActive = regularIds.length > 0
    && regularIds.every(id => state.selectedStoreIds.has(id))
    && stores.filter(store => OPTIONAL_STORE_IDS.has(store.id)).every(store => !state.selectedStoreIds.has(store.id));
  const selectedAll = stores.length > 0 && stores.every(store => state.selectedStoreIds.has(store.id));
  const selectedNone = stores.length > 0 && state.selectedStoreIds.size === 0;
  els.regularStoresButton?.classList.toggle('active', regularSelectionActive);
  els.allStoresButton?.classList.toggle('active', selectedAll);
  els.clearStoresButton?.classList.toggle('active', selectedNone);

  if (stores.length === 0) {
    els.storeFilter.innerHTML = '<div class="store-empty">Aucune épicerie disponible pour cette semaine.</div>';
    return;
  }

  for (const store of stores) {
    const label = document.createElement('label');
    label.className = `store-choice ${OPTIONAL_STORE_IDS.has(store.id) ? 'optional' : ''}`;
    label.innerHTML = `
      <input type="checkbox" value="${escapeHtml(store.id)}" ${state.selectedStoreIds.has(store.id) ? 'checked' : ''} />
      <span>${escapeHtml(store.name)}</span>
      <small>${store.count} produit${store.count > 1 ? 's' : ''}</small>
    `;
    els.storeFilter.append(label);
  }
}

function renderModeTabs() {
  if (!els.modeTabs) return;
  for (const button of els.modeTabs.querySelectorAll('button[data-mode]')) {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
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
  const badgeClass = item.itemKind === 'seen' ? 'seen' : 'deal';
  const badgeLabel = item.itemKind === 'seen' ? 'Produit trouvé' : (item.badgeLabel ?? 'Bon prix');
  const card = document.createElement('article');
  card.className = `item-card ${selected ? 'selected' : ''}`;
  card.innerHTML = `
    <div class="product-media">
      ${item.proofImageUrl ? `<img class="proof" src="${escapeHtml(item.proofImageUrl)}" alt="Preuve prix ${escapeHtml(item.name)}" width="520" height="360" loading="lazy" />` : '<div class="proof-missing"><span>Image non disponible</span><small>Le prix reste vérifié par les données de la semaine.</small></div>'}
      <span class="media-store">${escapeHtml(displayStoreName(item.storeId, item.storeName))}</span>
    </div>
    <div class="product-body">
      <div class="product-main">
        <span class="item-main">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <span class="store-line">📍 ${escapeHtml(displayStoreName(item.storeId, item.storeName))}</span>
          <span class="item-kind ${badgeClass}">${escapeHtml(badgeLabel)}</span>
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
  const categories = displayCategories();
  const category = categories.find(candidate => candidate.id === state.activeCategoryId) ?? ALL_CATEGORY;
  ensureSelectedStores();
  if (!category) return;
  state.activeCategoryId = category.id;

  if (allWeekStores().length > 0 && state.selectedStoreIds.size === 0) {
    const section = document.createElement('section');
    section.className = 'category';
    section.innerHTML = `
      <div class="category-title">
        <div>
          <p class="eyebrow">Épiceries</p>
          <h2><span>🛒</span>Choisis tes épiceries</h2>
        </div>
      </div>
      <div class="empty-state search-empty">
        <p>Choisis au moins une épicerie pour voir les produits.</p>
        <span>Tu peux utiliser Épiceries régulières, Tout inclure, ou cocher les magasins un par un.</span>
      </div>
    `;
    els.items.append(section);
    return;
  }

  const baseItems = query
    ? allWeekItems().filter(itemMatchesSelectedStores)
    : categoryItems(category);
  const sourceItems = query ? baseItems.filter(item => itemSearchText(item).includes(query)) : baseItems;
  const section = document.createElement('section');
  section.className = 'category';
  section.id = `category-${query ? 'search' : category.id}`;
  const titleLabel = query ? 'Recherche' : 'Rayon';
  const titleIcon = query ? '⌕' : escapeHtml(category.emoji);
  const titleText = query
      ? `Résultats pour “${escapeHtml(state.searchQuery.trim())}”`
      : escapeHtml(categoryLabel(category));
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
    const storeId = canonicalStoreId(item.storeId);
    if (!stores.has(storeId)) {
      stores.set(storeId, {
        id: storeId,
        name: displayStoreName(storeId, item.storeName),
        address: item.storeAddress,
        items: [],
        estimate: estimateBasketTotal([]),
      });
    }
    stores.get(storeId).items.push(item);
  }
  for (const store of stores.values()) {
    store.estimate = estimateBasketTotal(store.items);
  }
  return [...stores.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

function renderSelection() {
  const count = state.selected.size;
  const selectedItems = [...state.selected.values()];
  els.selectionSummary.textContent = count === 0 ? 'Aucun produit sélectionné' : `${count} produit${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}`;
  if (els.selectionEstimate) {
    els.selectionEstimate.innerHTML = count === 0 ? '' : renderEstimateSummary(selectedItems);
  }
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

    const caveat = estimateCaveat(store.estimate);
    const subtotal = document.createElement('div');
    subtotal.className = 'store-subtotal';
    subtotal.innerHTML = `
      <span>Sous-total estimé</span>
      <strong translate="no">${escapeHtml(formatEstimateCad(store.estimate.subtotal))}</strong>
      ${caveat ? `<small>${escapeHtml(caveat)}</small>` : ''}
    `;
    block.append(subtotal);

    els.selectionList.append(block);
  }
}

function setExportStatus(message, tone = '') {
  if (exportStatusTimer) {
    clearTimeout(exportStatusTimer);
    exportStatusTimer = null;
  }

  els.exportStatus.textContent = message;
  els.exportStatus.className = `export-status ${tone}`.trim();

  if (message && tone === 'success') {
    exportStatusTimer = setTimeout(() => {
      els.exportStatus.textContent = '';
      els.exportStatus.className = 'export-status';
      exportStatusTimer = null;
    }, 5000);
  }
}

function slugFileName(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'liste-epicerie';
}

function buildPrintableHtml(selectedItems) {
  const stores = groupSelectedByStore();
  const estimate = estimateBasketTotal(selectedItems);
  const caveat = estimateCaveat(estimate);
  const notes = state.notes.trim();
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
      margin-bottom: 6px;
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
      ${escapeHtml(selectedItems.length)} produit${selectedItems.length > 1 ? 's' : ''}<br />
      ${escapeHtml(stores.length)} épicerie${stores.length > 1 ? 's' : ''}<br />
      Généré le ${escapeHtml(generated)}
    </div>
  </header>
  <div class="summary">
    <div>${escapeHtml(selectedItems.length)} produit${selectedItems.length > 1 ? 's' : ''} choisi${selectedItems.length > 1 ? 's' : ''}</div>
    <div>${escapeHtml(stores.length)} arrêt${stores.length > 1 ? 's' : ''}</div>
    <div>Total estimé: ${escapeHtml(formatEstimateCad(estimate.subtotal))}</div>
    <div>Prix en CAD</div>
  </div>
  <p class="estimate-caveat">Avant taxes, dépôts, quantités réelles et prix au poids. ${escapeHtml(caveat)}</p>
  ${notes ? `<section class="notes"><h2>Notes</h2><p>${escapeHtml(notes)}</p></section>` : ''}
  ${storeBlocks}
  ${finalTotalBlock}
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
  const estimate = estimateBasketTotal(selectedItems);
  const caveat = estimateCaveat(estimate);
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
  text(`${selectedItems.length} produit${selectedItems.length > 1 ? 's' : ''}`, pageWidth - margin, y + 8, { size: 11, color: [95, 90, 80], align: 'right' });
  text(`${stores.length} épicerie${stores.length > 1 ? 's' : ''}`, pageWidth - margin, y + 25, { size: 11, color: [95, 90, 80], align: 'right' });
  text(`Total estimé: ${formatEstimateCad(estimate.subtotal)}`, pageWidth - margin, y + 42, { style: 'bold', size: 11, color: [35, 88, 69], align: 'right' });
  text('Prix en CAD', pageWidth - margin, y + 59, { size: 10, color: [95, 90, 80], align: 'right' });
  y += 64;
  line(y, [23, 23, 20], 1.8);
  y += 20;
  const estimateNoteLines = pdf.splitTextToSize(`Avant taxes, dépôts, quantités réelles et prix au poids. ${caveat}`, tableWidth);
  for (const estimateNoteLine of estimateNoteLines) {
    text(estimateNoteLine, margin, y, { size: 9, color: [95, 90, 80] });
    y += 11;
  }
  y += 13;

  const notes = state.notes.trim();
  if (notes) {
    addPageIfNeeded(70);
    text('Notes', margin, y, { font: 'times', style: 'bold', size: 16 });
    y += 18;
    const noteLines = pdf.splitTextToSize(notes, tableWidth);
    for (const noteLine of noteLines) {
      text(noteLine, margin, y, { size: 11, color: [95, 90, 80] });
      y += 14;
    }
    y += 12;
  }

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
    addPageIfNeeded(34);
    pdf.setFillColor(229, 240, 233);
    pdf.rect(margin, y, tableWidth, 28, 'F');
    text('Sous-total estimé', margin + 10, y + 18, { style: 'bold', size: 11, color: [35, 88, 69] });
    text(formatEstimateCad(store.estimate.subtotal), margin + itemWidth + 10, y + 18, { style: 'bold', size: 12, color: [35, 88, 69] });
    y += 32;
    const storeCaveat = estimateCaveat(store.estimate);
    if (storeCaveat) {
      const caveatLines = pdf.splitTextToSize(storeCaveat, tableWidth);
      for (const caveatLine of caveatLines) {
        addPageIfNeeded(14);
        text(caveatLine, margin, y, { size: 9, color: [95, 90, 80] });
        y += 12;
      }
    }
    y += 22;
  }

  addPageIfNeeded(76);
  pdf.setDrawColor(35, 88, 69);
  pdf.setLineWidth(1.3);
  pdf.setFillColor(229, 240, 233);
  pdf.roundedRect(margin, y, tableWidth, 54, 7, 7, 'FD');
  text('Total estimé de la liste', margin + 12, y + 22, { style: 'bold', size: 12, color: [35, 88, 69] });
  text(formatEstimateCad(estimate.subtotal), pageWidth - margin - 12, y + 22, { style: 'bold', size: 16, color: [35, 88, 69], align: 'right' });
  const finalCaveatLines = pdf.splitTextToSize(`Avant taxes, dépôts, quantités réelles et prix au poids. ${caveat}`, tableWidth - 24);
  y += 38;
  for (const finalCaveatLine of finalCaveatLines) {
    text(finalCaveatLine, margin + 12, y, { size: 9, color: [95, 90, 80] });
    y += 11;
  }

  pdf.save(fileNameForCurrentWeek('pdf'));
  setExportStatus('PDF téléchargé.', 'success');
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
    setExportStatus('Ajoute au moins un produit avant de créer le PDF.', 'warning');
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
        notes: state.notes,
      }),
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Export local indisponible');
    }
    const text = await response.text();
    const result = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(result.error || 'Export impossible');
    setExportStatus('PDF sauvegardé.', 'success');
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
  loadNotes();
  state.activeCategoryId = 'all';
  state.searchQuery = '';
  els.searchInput.value = '';
  state.selectedStoreIds = defaultStoreSelection(allWeekStores());
  renderWeeks();
  renderWeekHeader();
  renderMethodNote();
  renderModeTabs();
  renderStoreFilter();
  renderCategoryTabs();
  renderItems();
  renderSelection();
}

async function init() {
  try {
    const index = await loadJson('data/weeks/index.json');
    state.weeks = index.weeks ?? [];
    const weeks = visibleWeeks(state.weeks);
    if (weeks.length > 0) {
      await selectWeek(weeks[0]);
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
  const input = event.target.closest('input[type="checkbox"]');
  if (!input) return;
  const storeId = canonicalStoreId(input.value);
  if (input.checked) {
    state.selectedStoreIds.add(storeId);
  } else {
    state.selectedStoreIds.delete(storeId);
  }
  if (!displayCategories().some(category => category.id === state.activeCategoryId)) {
    state.activeCategoryId = 'all';
  }
  renderStoreFilter();
  renderCategoryTabs();
  renderItems();
});
els.regularStoresButton?.addEventListener('click', () => {
  state.selectedStoreIds = defaultStoreSelection(allWeekStores());
  renderStoreFilter();
  renderCategoryTabs();
  renderItems();
});
els.allStoresButton?.addEventListener('click', () => {
  state.selectedStoreIds = allStoreSelection(allWeekStores());
  renderStoreFilter();
  renderCategoryTabs();
  renderItems();
});
els.clearStoresButton?.addEventListener('click', () => {
  state.selectedStoreIds = new Set();
  renderStoreFilter();
  renderCategoryTabs();
  renderItems();
});
els.modeTabs?.addEventListener('click', event => {
  const button = event.target.closest('button[data-mode]');
  if (!button || button.dataset.mode === state.mode) return;
  state.mode = button.dataset.mode;
  ensureSelectedStores();
  if (!displayCategories().some(category => category.id === state.activeCategoryId)) {
    state.activeCategoryId = 'all';
  }
  renderModeTabs();
  renderStoreFilter();
  renderCategoryTabs();
  renderItems();
});
els.notesInput?.addEventListener('input', event => {
  state.notes = event.target.value;
  saveNotes();
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
