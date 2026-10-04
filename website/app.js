import { readDeviceProfile } from './shopping-profile.js';
import { createListPdf } from './list-pdf.js';
import { setupAccountButton, accountApi } from './account-client.js';
import { buildShoppingPrintHtml } from './print-document.js';
import { prepareOfferIds, applyOfferEvidence } from './offer-identity.js';
import { mountProofImage } from './proof-image.js';
import { setupShoppingWorkspace } from './shopping-workspace.js';
import { pricePill, priceComparison, bestComparableOffer, packageUnitPrice, basketSavings, basketSavingsDetails, productTitle, sortProducts, createOfferIndex, loyaltyLabel } from './product-details.js';
import { setupPriceHistory } from './price-history.js';
import { createListSnapshot } from './saved-lists.js';
import { setupListDialog } from './list-dialog.js';
import { openComparison } from './price-comparison.js';
import { availableBranches, activeBranch, storeAddress, compactStoreAddress, branchLocationLabel } from './store-directory.js';
import { openStorePicker } from './store-picker.js';
import { loadFlyers } from './flyers.js';
import { enhanceDropdown } from './dropdown.js';
import { setupLocationPicker } from './location-picker.js';
import { mapsUrl, validCoordinates, branchDistanceLabel, locationCaption } from './location-data.js';
let regionDropdown, locationPicker;

const state = {
  weeks: [],
  regions: [],
  regionId: 'joliette',
  weekRequest: 0,
  week: null,
  selected: new Map(),
  activeCategoryId: 'all',
  selectedStoreIds: new Set(),
  searchQuery: '',
  mode: 'deals',
  savingsOnly: false,
  notes: '',
  storeDirectory: { stores: {}, branches: [] },
  branchChoices: {},
  accountFavorites: {},
  location: null,
  offerCandidates: () => [],
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
  shareButton: document.querySelector('#share-button'),
  clearButton: document.querySelector('#clear-button'),
  emptyTemplate: document.querySelector('#empty-template'),
  imagePreview: document.querySelector('#image-preview'),
  imagePreviewImg: document.querySelector('#image-preview-img'),
  imagePreviewTitle: document.querySelector('#image-preview-title'),
  imagePreviewMeta: document.querySelector('#image-preview-meta'),
  imagePreviewClose: document.querySelector('#image-preview-close'),
};

let exportStatusTimer = null;
let lastImagePreviewTrigger = null;

function moneySafe(text) {
  return text || '';
}

const VARIABLE_PRICE_UNITS = new Set(['kg', 'lb', 'lbs', '100g', 'l', 'litre', 'litres', 'rebate', 'rabais']);
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
  return `
    <div class="estimate-total">
      <span>Total estimé</span>
      <strong translate="no">${escapeHtml(formatEstimateCad(estimate.subtotal))}</strong>
    </div>
    <p>Hors taxes et dépôts.${estimate.variableCount ? ` ${estimate.variableCount} prix au poids non inclus.` : ''}${estimate.unknownCount ? ` ${estimate.unknownCount} prix à vérifier.` : ''}</p>
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
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
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
  return state.week ? `bons-speciaux:selected:${state.regionId === 'joliette' ? '' : state.regionId + ':'}${state.week.slug}` : '';
}

function notesKey() {
  return state.week ? `bons-speciaux:notes:${state.regionId === 'joliette' ? '' : state.regionId + ':'}${state.week.slug}` : '';
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
  if (!canonicalStoreId(item?.storeId)?.startsWith('costco-')) return true;
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
  return stores.filter(store => !OPTIONAL_STORE_IDS.has(store.id) && !store.id.startsWith('costco-')).map(store => store.id);
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

function itemMatchesSavings(item) {
  return !state.savingsOnly || Boolean(priceComparison(item, state.offerCandidates(item), state.selectedStoreIds));
}

function visibleOffers(items) {
  const scoped = items.filter(itemMatchesSelectedStores);
  const offers = state.mode === 'deals' ? scoped.map(item => bestComparableOffer(item, state.offerCandidates(item), state.selectedStoreIds)) : scoped;
  return [...new Map(offers.map(item => [item.id, item])).values()].filter(itemMatchesSavings);
}

function categoryItems(category) {
  const items = category?.id === 'all' ? allWeekItems() : (category?.items ?? []).filter(isShopperVisibleItem);
  return visibleOffers(items);
}

function allWeekStores() {
  if (!state.week) return [];
  const stores = new Map((state.week.stores ?? []).map(store => {
    const id = canonicalStoreId(store.id);
    return [id, { id, name: displayStoreName(id, store.name), count: 0 }];
  }));
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
  if (showAllWeeks()) return weeks;
  return productionWeeks;
}

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Impossible de charger ${path}`);
  return response.json();
}

function renderWeeks() {
  els.weekOptions.innerHTML = '';
  els.weekLabel.textContent = state.week ? state.week.folderName : 'Choisir une semaine';
  for (const week of visibleWeeks(state.weeks)) {
    const option = document.createElement('button');
    option.type = 'button';
    option.role = 'option';
    option.className = state.week?.slug === week.slug ? 'active' : '';
    option.setAttribute('aria-selected', state.week?.slug === week.slug ? 'true' : 'false');
    option.textContent = `${week.folderName} · ${week.itemCount} bons prix`;
    option.addEventListener('click', () => {
      closeWeekMenu();
      void selectWeek(week).catch(err => { els.weekHeader.textContent = `Chargement impossible : ${err.message}. Réessaie de choisir la semaine.`; });
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
      <h2>${state.mode === 'all' ? 'Tous les produits' : state.regionId === 'joliette' ? 'Bons prix' : 'Rabais en circulaire'}</h2>
      <p class="week-context">${escapeHtml(state.week.weekRange)} · ${state.week.allItemCount ?? state.week.itemCount} produits en circulaire · ${state.week.stores.length} épiceries</p>
    </div>
  `;
}

function renderMethodNote() {
  if (!state.week || !els.methodNoteBody) {
    if (els.methodNoteBody) els.methodNoteBody.innerHTML = '';
    return;
  }

  els.methodNoteBody.innerHTML = `
    <span>${state.regionId === 'joliette' ? 'Circulaires du Québec' : `Circulaires proposées pour ${escapeHtml(state.week.regionName)} (${escapeHtml(state.week.sourcePostalCode)})`} · Disponibilité selon la succursale.</span>
    <span>Costco : formats en vrac et prix membre possibles.</span>
  `;
}

function renderCategoryTabs() {
  els.categoryTabs.innerHTML = '';
  document.querySelector('#active-rayon-label').textContent = displayCategories().find(category => category.id === state.activeCategoryId)?.title ?? 'Tous';
  if (!state.week) return;
  for (const category of displayCategories()) {
    const scopedItems = categoryItems(category);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = state.activeCategoryId === category.id ? 'active' : '';
    button.setAttribute('aria-pressed', String(state.activeCategoryId === category.id));
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
  document.querySelector('#store-selection-count').textContent = `${state.selectedStoreIds.size} / ${stores.length}`;
  const regularIds = regularStoreIds(stores);
  const regularSelectionActive = regularIds.length > 0
    && regularIds.every(id => state.selectedStoreIds.has(id))
    && state.selectedStoreIds.size === regularIds.length;
  const selectedAll = stores.length > 0 && stores.every(store => state.selectedStoreIds.has(store.id));
  const selectedNone = stores.length > 0 && state.selectedStoreIds.size === 0;
  for (const [button, active] of [[els.regularStoresButton, regularSelectionActive], [els.allStoresButton, selectedAll], [els.clearStoresButton, selectedNone]]) {
    button?.classList.toggle('active', active);
    button?.setAttribute('aria-pressed', String(active));
  }

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


function openImagePreview(item) {
  if (!els.imagePreview || !els.imagePreviewImg || !item.proofImageUrl) return;

  lastImagePreviewTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  mountProofImage(els.imagePreviewImg, item, 'image-preview-img');
  if (els.imagePreviewTitle) els.imagePreviewTitle.textContent = item.name;
  if (els.imagePreviewMeta) {
    els.imagePreviewMeta.textContent = `${displayStoreName(item.storeId, item.storeName)} · ${moneySafe(item.price)}`;
  }
  els.imagePreview.hidden = false;
  els.imagePreview.setAttribute('aria-hidden', 'false');
  document.body.classList.add('preview-open');
  els.imagePreviewClose?.focus();
}

function closeImagePreview() {
  if (!els.imagePreview || els.imagePreview.hidden) return;

  els.imagePreview.hidden = true;
  els.imagePreview.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('preview-open');
  if (els.imagePreviewImg) {
    els.imagePreviewImg.replaceChildren();
  }
  lastImagePreviewTrigger?.focus();
  lastImagePreviewTrigger = null;
}

function renderItemCard(item) {
  const selected = state.selected.has(item.id);
  const candidates = state.offerCandidates(item);
  const pill = pricePill(item, candidates, state.selectedStoreIds);
  const facts = item.offerEvidence;
  const rate = pill?.saving?.normalized ? packageUnitPrice(item) : null;
  const card = document.createElement('article');
  card.className = `item-card ${selected ? 'selected' : ''}`;
  card.innerHTML = `
    <div class="product-media">
      ${item.proofImageUrl ? `<button class="proof-button" type="button" aria-label="Agrandir la photo de prix pour ${escapeHtml(item.name)}"><img class="proof" src="${escapeHtml(item.proofImageUrl)}" alt="Preuve prix ${escapeHtml(item.name)}" width="520" height="360" loading="lazy" /></button>` : '<div class="proof-missing"><span>Image non disponible</span></div>'}
      <span class="media-store">${escapeHtml(displayStoreName(item.storeId, item.storeName))}</span>
      <label class="add-control" title="${selected ? 'Retirer de la liste' : 'Ajouter à la liste'}">
        <input type="checkbox" ${selected ? 'checked' : ''} aria-label="Choisir ${escapeHtml(item.name)}" />
        <span aria-hidden="true">${selected ? '✓ Ajouté' : '+'}</span>
      </label>
    </div>
    <div class="product-body">
      <span class="item-name">${escapeHtml(productTitle(item.name))}</span>
      <div class="product-purchase">
        <span class="price" translate="no">${escapeHtml(moneySafe(item.price))}</span>
        ${pill ? `<button type="button" class="price-pill ${pill.tone}" data-item-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(pill.label)} : comparer ${escapeHtml(item.name)}">${escapeHtml(pill.label)}</button>` : ''}
      </div>
      <div class="product-meta">${rate ? `<span>${escapeHtml(formatEstimateCad(rate.amount))}/${escapeHtml(rate.unit)}</span>` : ''}${facts?.formatLabel ? `<span>${escapeHtml(facts.formatLabel)}</span>` : item.scale ? `<span>${escapeHtml(/format.*(?:vérifier|confirmé)/i.test(item.scale) ? 'Format à vérifier' : item.scale)}</span>` : ''}${facts?.member ? `<span class="member-label">${escapeHtml(loyaltyLabel(item))}</span>` : ''}</div>
      ${facts?.history?.points?.length && !pill?.history ? '<button type="button" class="product-history" aria-haspopup="dialog">Historique du prix</button>' : ''}

    </div>
  `;
  card.querySelector('.product-history')?.addEventListener('click', () => priceHistory.open(allSelectableItems().filter(itemMatchesSelectedStores), state.week, item.id));
  card.querySelector('.price-pill')?.addEventListener('click', () => openComparison(item, pill, candidates, state.selectedStoreIds, (offer, selected) => {
    if (selected) state.selected.set(offer.id, offer);
    else state.selected.delete(offer.id);
    saveSelection(); renderWeekHeader(); renderCategoryTabs(); renderItems(); renderSelection();
  }, id => state.selected.has(id), offer => ({
    address: storeAddress(offer, state.storeDirectory, state.regionId, state.branchChoices, state.location),
    branch: activeBranch(state.storeDirectory, state.regionId, offer.storeId, state.branchChoices, state.location),
  })));
  const proofButton = card.querySelector('.proof-button');
  if (proofButton) mountProofImage(proofButton, item);
  card.querySelector('.proof')?.addEventListener('error', () => {
    const missing = document.createElement('div');
    missing.className = 'proof-missing';
    missing.textContent = 'Photo indisponible pour le moment.';
    card.querySelector('.proof-button')?.replaceWith(missing);
  });
  card.querySelector('.proof-button')?.addEventListener('click', () => openImagePreview(item));
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
    ? visibleOffers(allWeekItems())
    : categoryItems(category);
  const sourceItems = sortProducts(query ? baseItems.filter(item => itemSearchText(item).includes(query)) : baseItems);
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

  if (sourceItems.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state search-empty';
    empty.innerHTML = state.savingsOnly
      ? '<p>Aucun prix inférieur pour cette sélection.</p><span>Désactive « Prix plus bas » pour voir les autres produits.</span>'
      : '<p>Aucun résultat.</p><span>Essaie un mot plus simple ou choisis une autre épicerie.</span>';
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
        address: storeAddress(item, state.storeDirectory, state.regionId, state.branchChoices, state.location),
        hasBranches: availableBranches(state.storeDirectory, state.regionId, storeId, '', state.location).length > 0,
        branch: activeBranch(state.storeDirectory, state.regionId, storeId, state.branchChoices, state.location),
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
  document.querySelector('#basket-count').textContent = count;
  const selectedItems = [...state.selected.values()];
  const total = estimateBasketTotal(selectedItems);
  document.querySelector('#basket-mobile-total').textContent = count
    ? total.fixedCount ? `Total estimé : ${formatEstimateCad(total.subtotal)}` : 'Total à calculer'
    : 'Préparer mes courses';
  const savings = basketSavingsDetails(selectedItems, allSelectableItems(), state.selectedStoreIds);
  const compactSavings = document.querySelector('#basket-mobile-savings');
  compactSavings.hidden = savings.amount <= 0;
  compactSavings.textContent = `${formatEstimateCad(savings.amount)} d’économies`;
  const weightSavings = savings.entries.filter(entry => entry.saving && !entry.saving.canTotal).length;
  const savingsBlock = document.querySelector('#selection-savings');
  savingsBlock.hidden = count === 0;
  savingsBlock.innerHTML = `<span>Économies sur la liste</span><strong>${escapeHtml(formatEstimateCad(savings.amount))}</strong>`;
  savingsBlock.disabled = savings.amount <= 0 && weightSavings === 0;
  document.querySelector('#save-button').disabled = count === 0;
  els.selectionSummary.hidden = true;
  els.selectionSummary.textContent = '';
  if (els.selectionEstimate) {
    els.selectionEstimate.innerHTML = count === 0 ? '' : renderEstimateSummary(selectedItems);
  }
  els.selectionList.innerHTML = '';

  if (count === 0) {
    els.selectionList.append(els.emptyTemplate.content.cloneNode(true));
    return;
  }

  for (const store of groupSelectedByStore()) {
    const block = document.createElement('section');
    block.className = 'store-block';
    block.innerHTML = `
      <header class="store-banner basket-store-banner">
        <div class="store-banner-identity">
          <h3>${escapeHtml(store.name)}</h3>
          ${Number.isFinite(store.branch?.distance) ? `<span class="store-distance">${escapeHtml(branchDistanceLabel(store.branch.distance, state.location))}</span>` : ''}
        </div>
        <div class="store-banner-destination">
          <a class="store-address" href="${escapeHtml(mapsUrl(store.name, store.address || (!store.branch && (state.location?.name || state.regions.find(region => region.id === state.regionId)?.name)), store.branch))}" target="_blank" rel="noopener noreferrer" aria-label="Ouvrir ${escapeHtml(store.name)}${store.address ? `, ${escapeHtml(store.address)}` : ''} dans Google Maps">${escapeHtml(compactStoreAddress(store.address) || branchLocationLabel(store.branch) || 'Voir sur Google Maps')}</a>
        ${store.hasBranches ? `<button type="button" class="store-locator" data-store-picker="${escapeHtml(store.id)}" aria-label="${store.address ? 'Changer de' : 'Choisir une'} succursale pour ${escapeHtml(store.name)}" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg><span>${store.address ? 'Modifier' : 'Choisir'}</span></button>` : ''}
        </div>
      </header>
    `;
    block.querySelector('[data-store-picker]')?.addEventListener('click', () => {
      openStorePicker({
        directory: state.storeDirectory, regionId: state.regionId,
        regionName: state.regions.find(region => region.id === state.regionId).name,
        store, location: state.location, chosenId: activeBranch(state.storeDirectory, state.regionId, store.id, state.branchChoices, state.location)?.id,
        choose: branchId => {
          if (branchId) state.branchChoices[store.id] = branchId;
          else delete state.branchChoices[store.id];
          localStorage.setItem(`bons-speciaux:branches:${state.regionId}`, JSON.stringify(state.branchChoices));
          renderSelection();
        },
      });
    });

    for (const item of store.items) {
      const saving = savings.entries.find(entry => entry.id === item.id)?.saving;
      const row = document.createElement('div');
      row.className = 'selected-item';
      row.innerHTML = `
        <span>
          ${saving?.amount > 0 ? `<button type="button" class="selected-product" aria-haspopup="dialog" aria-label="Détail des économies pour ${escapeHtml(item.name)}">${escapeHtml(productTitle(item.name))}</button>` : `<strong>${escapeHtml(productTitle(item.name))}</strong>`}
          <small translate="no">${escapeHtml(item.price)}${loyaltyLabel(item) ? `<span class="selected-condition">${escapeHtml(loyaltyLabel(item))}</span>` : ''}</small>
          ${saving ? `<span class="selected-saving">${escapeHtml(formatEstimateCad(saving.amount))}${escapeHtml(saving.unit)} de moins</span>` : ''}
        </span>
        <button type="button" class="selected-remove" aria-label="Retirer ${escapeHtml(item.name)}">Retirer</button>
      `;
      row.querySelector('.selected-product')?.addEventListener('click', () => listDialog.showSavings(currentListSnapshot(), item.id));
      row.querySelector('.selected-remove').addEventListener('click', () => {
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
      <span>${store.estimate.fixedCount ? 'Sous-total' : 'Selon les quantités'}</span>
      <strong translate="no">${store.estimate.fixedCount ? escapeHtml(formatEstimateCad(store.estimate.subtotal)) : '—'}</strong>
      ${store.estimate.fixedCount && caveat ? `<small>${store.estimate.variableCount ? `${store.estimate.variableCount} prix au poids non inclus.` : `${store.estimate.unknownCount} prix à vérifier.`}</small>` : ''}
    `;
    block.append(subtotal);

    els.selectionList.append(block);
  }
}

function setExportStatus(message, tone = '', detail = '') {
  if (exportStatusTimer) {
    clearTimeout(exportStatusTimer);
    exportStatusTimer = null;
  }

  if (!message) {
    els.exportStatus.textContent = '';
    els.exportStatus.className = 'export-status';
    return;
  }

  els.exportStatus.innerHTML = `
    <span>${escapeHtml(message)}</span>
    ${detail ? `<small>${escapeHtml(detail)}</small>` : ''}
  `;
  els.exportStatus.className = `export-status ${tone}`.trim();

  if (message && tone === 'success') {
    exportStatusTimer = setTimeout(() => {
      els.exportStatus.textContent = '';
      els.exportStatus.className = 'export-status';
      exportStatusTimer = null;
    }, 7000);
  }
}

function slugFileName(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'liste-epicerie';
}

function buildPrintableHtml(selectedItems) {
  return buildShoppingPrintHtml({
    week: state.week,
    stores: groupSelectedByStore(),
    estimate: estimateBasketTotal(selectedItems),
    savings: basketSavings(selectedItems, allSelectableItems(), state.selectedStoreIds),
    notes: state.notes,
  });
}

function fileNameForCurrentWeek(extension) {
  return `${slugFileName(state.week?.title || 'liste-epicerie')}.${extension}`;
}

async function createBrowserPdfDocument(snapshot = null) {
  return createListPdf(snapshot ?? currentListSnapshot());
}

async function downloadBrowserPdf() {
  const { pdf, fileName } = await createBrowserPdfDocument();
  pdf.save(fileName);
  setExportStatus('PDF téléchargé.', 'success', fileName);
}

async function shareBasketPdf() {
  if (!state.week) return;
  const selectedIds = [...state.selected.keys()];
  if (selectedIds.length === 0) {
    setExportStatus('Ajoute au moins un produit avant de partager la liste.', 'warning');
    return;
  }

  const originalLabel = els.shareButton.textContent;
  els.shareButton.disabled = true;
  els.shareButton.textContent = 'Prépare...';
  setExportStatus('Préparation du partage...', '');

  try {
    const { pdf, fileName } = await createBrowserPdfDocument();
    const blob = pdf.output('blob');
    const file = typeof File === 'function'
      ? new File([blob], fileName, { type: 'application/pdf' })
      : null;

    if (file && navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({
        title: 'Ma liste d’épicerie',
        text: ['Ma liste d’épicerie', state.week?.weekRange].filter(Boolean).join(' — '),
        files: [file],
      });
      setExportStatus('Liste prête à partager.', 'success', fileName);
      return;
    }

    pdf.save(fileName);
    setExportStatus('PDF téléchargé.', 'success', fileName);
  } catch (err) {
    if (err?.name === 'AbortError') {
      setExportStatus('');
      return;
    }
    console.error('PDF share failed:', err);
    setExportStatus('Partage indisponible. Essaie “Exporter PDF”.', 'warning');
  } finally {
    els.shareButton.disabled = false;
    els.shareButton.textContent = originalLabel;
  }
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
        regionId: state.regionId,
        storeIds: [...state.selectedStoreIds],
        selectedIds,
        branchChoices: state.branchChoices,
        location: state.location,
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
    setExportStatus('PDF sauvegardé sur le bureau.', 'success', result.fileName || '');
  } catch (err) {
    openBrowserPrintExport();
  } finally {
    els.printButton.disabled = false;
    els.printButton.textContent = originalLabel;
  }
}

async function selectWeek(weekMeta, regionId = state.regionId, weeks = state.weeks) {
  if (!weekMeta) throw new Error("Aucune semaine disponible dans cette région");
  const request = ++state.weekRequest;
  els.weekHeader.textContent = 'Chargement des circulaires…';
  const week = prepareOfferIds(await loadJson(weekMeta.path));
  if (request !== state.weekRequest) return;
  week.dataPath = weekMeta.path.replace(/week\.json$/, '');
  for (const categories of [week.categories, week.dealCategories, week.allCategories]) {
    for (const category of categories ?? []) for (const item of category.items) {
      const location = regionId === 'joliette' ? state.storeDirectory.stores[canonicalStoreId(item.storeId)] : null;
      if (location) item.storeAddress = location.address ?? '';
    }
  }
  try {
    const evidence = await loadJson(weekMeta.path.replace(/week\.json$/, 'offer-evidence.json'));
    if (request !== state.weekRequest) return;
    for (const categories of [week.categories, week.dealCategories, week.allCategories]) {
      for (const category of categories ?? []) for (const item of category.items) applyOfferEvidence(item, evidence.offers[item.id]);
    }
  } catch (error) { console.error('Offer comparison details unavailable:', error); }
  if (request !== state.weekRequest) return;
  state.week = week;
  state.regionId = regionId;
  state.branchChoices = {};
  try {
    const saved = JSON.parse(localStorage.getItem(`bons-speciaux:branches:${regionId}`) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) state.branchChoices = saved;
  } catch (error) { console.error('Saved branch choices unavailable:', error); }
  for (const store of allWeekStores()) {
    const storeId = canonicalStoreId(store.id);
    const chain = storeId.replace(/-(joliette|montreal|quebec)$/, '');
    if (!state.branchChoices[storeId] && state.accountFavorites[chain]) state.branchChoices[storeId] = state.accountFavorites[chain];
  }
  state.weeks = weeks;
  localStorage.setItem('bons-speciaux:region', regionId);
  document.querySelector('#region-select').value = regionId;
  updateLocationCaption();
  state.offerCandidates = createOfferIndex(allSelectableItems());
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
  await loadFlyers(week);
}

async function init() {
  // The weekly catalogue remains usable while sign-in loads independently.
  let accountRequest = 0;
  void setupAccountButton(document.querySelector('#account-toggle'), async owner => {
    const request = ++accountRequest;
    const profile = owner ? (await accountApi('/profile')).profile : readDeviceProfile(localStorage);
    if (request !== accountRequest) return;
    state.accountFavorites = profile.favorites || {};
    if (!state.week) return;
    for (const store of allWeekStores()) {
      const storeId = canonicalStoreId(store.id), chain = storeId.replace(/-(joliette|montreal|quebec)$/, '');
      if (!state.branchChoices[storeId] && state.accountFavorites[chain]) state.branchChoices[storeId] = state.accountFavorites[chain];
    }
    renderSelection();
  }, error => setExportStatus(error.message, 'warning'));
  try {
    try {
      state.storeDirectory = await loadJson('data/store-locations.json');
    } catch (error) {
      console.error('Store address directory unavailable:', error);
    }
    const registry = await loadJson('data/regions.json');
    state.regions = registry.regions;
    const chooser = document.querySelector('#region-select');
    chooser.replaceChildren();
    for (const region of state.regions) {
      const option = document.createElement('option'); option.value = region.id; option.textContent = region.name; chooser.append(option);
    }
    state.regionId = state.regions.some(region => region.id === localStorage.getItem('bons-speciaux:region')) ? localStorage.getItem('bons-speciaux:region') : 'joliette';
    chooser.add(new Option('Autre ville ou ma position…', 'other'));
    chooser.value = state.regionId;
    try {
      const saved = JSON.parse(localStorage.getItem('bons-speciaux:location') || 'null');
      if (validCoordinates(saved) && saved.regionId === state.regionId) state.location = saved;
    } catch (error) { console.error('Saved location unavailable:', error); }
    regionDropdown = enhanceDropdown(chooser);
    locationPicker = setupLocationPicker({ directory: state.storeDirectory, regions: state.regions, choose: position => chooseRegion(position.regionId, position) });
    document.querySelector('#location-edit').addEventListener('click', () => locationPicker.open());
    const index = await loadJson(state.regions.find(region => region.id === state.regionId).indexPath);
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

function currentListSnapshot() {
  return createListSnapshot({
    week: { ...state.week, regionName: state.regions.find(region => region.id === state.regionId)?.name || state.week.regionName },
    regionId: state.regionId, stores: groupSelectedByStore(), notes: state.notes,
    estimate: estimateBasketTotal([...state.selected.values()]),
    savings: basketSavingsDetails([...state.selected.values()], allSelectableItems(), state.selectedStoreIds),
  });
}

const listDialog = setupListDialog({
  status: setExportStatus,
  exportCurrent: exportPdfToDesktop,
  exportSaved: async snapshot => {
    const { pdf, fileName } = await createBrowserPdfDocument(snapshot);
    pdf.save(fileName);
  },
});
const priceHistory = setupPriceHistory();
document.querySelector('#price-history-toggle').addEventListener('click', () => {
  if (state.week) priceHistory.open(allSelectableItems().filter(itemMatchesSelectedStores), state.week);
});
document.querySelector('#savings-filter').addEventListener('click', event => {
  state.savingsOnly = !state.savingsOnly;
  event.currentTarget.setAttribute('aria-pressed', String(state.savingsOnly));
  renderCategoryTabs();
  renderItems();
});
document.querySelector('#selection-savings').addEventListener('click', () => listDialog.showSavings(currentListSnapshot()));
document.querySelector('#save-button').addEventListener('click', () => listDialog.saveCurrent(currentListSnapshot()));
els.printButton.addEventListener('click', () => {
  if (!state.selected.size) { setExportStatus('Ajoute au moins un produit avant de créer le PDF.', 'warning'); return; }
  listDialog.showExport(currentListSnapshot());
});
els.shareButton.addEventListener('click', shareBasketPdf);
els.weekToggle.addEventListener('click', toggleWeekMenu);
document.addEventListener('click', event => {
  if (!event.target.closest('.week-field')) closeWeekMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Tab' && !els.imagePreview.hidden) {
    event.preventDefault();
    els.imagePreviewClose.focus();
  }
  if (event.key === 'Escape') {
    closeWeekMenu();
    closeImagePreview();
  }
});
els.imagePreview?.addEventListener('click', event => {
  if (event.target instanceof HTMLElement && event.target.dataset.previewClose === 'true') {
    closeImagePreview();
  }
});
els.imagePreviewClose?.addEventListener('click', closeImagePreview);
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
  renderSelection();
});
els.regularStoresButton?.addEventListener('click', () => {
  state.selectedStoreIds = defaultStoreSelection(allWeekStores());
  renderStoreFilter();
  renderCategoryTabs();
  renderItems();
  renderSelection();
});
els.allStoresButton?.addEventListener('click', () => {
  state.selectedStoreIds = allStoreSelection(allWeekStores());
  renderStoreFilter();
  renderCategoryTabs();
  renderItems();
  renderSelection();
});
els.clearStoresButton?.addEventListener('click', () => {
  state.selectedStoreIds = new Set();
  renderStoreFilter();
  renderCategoryTabs();
  renderItems();
  renderSelection();
});
els.modeTabs?.addEventListener('click', event => {
  const button = event.target.closest('button[data-mode]');
  if (!button || button.dataset.mode === state.mode) return;
  state.mode = button.dataset.mode;
  renderWeekHeader();
  ensureSelectedStores();
  if (!displayCategories().some(category => category.id === state.activeCategoryId)) {
    state.activeCategoryId = 'all';
  }
  renderModeTabs();
  renderStoreFilter();
  renderCategoryTabs();
  renderItems();
  renderSelection();
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

function updateLocationCaption() {
  const caption = document.querySelector('#location-caption');
  const region = state.regions.find(entry => entry.id === state.regionId);
  caption.hidden = false;
  caption.textContent = locationCaption(state.location, state.storeDirectory.regionCenters?.[state.regionId]?.name || region?.name, region?.name);
  document.querySelector('#location-edit').textContent = state.location ? 'Changer ma position' : 'Me localiser';
  regionDropdown?.sync();
}
let regionRequest = 0;
async function chooseRegion(regionId, position = null) {
  const region = state.regions.find(entry => entry.id === regionId);
  if (!region) throw new Error('Région inconnue.');
  const request = ++regionRequest;
  ++state.weekRequest;
  const chooser = document.querySelector('#region-select');
  const previousLocation = state.location;
  chooser.disabled = true; regionDropdown?.sync();
  try {
    const directory = await loadJson('data/store-locations.json');
    if (request !== regionRequest) return;
    Object.assign(state.storeDirectory, directory);
    if (regionId === state.regionId && state.week) {
      state.location = position;
      renderSelection();
    } else {
      const index = await loadJson(region.indexPath);
      if (request !== regionRequest) return;
      state.location = position;
      await selectWeek(visibleWeeks(index.weeks ?? [])[0], region.id, index.weeks ?? []);
    }
    if (request !== regionRequest) return;
    if (position) localStorage.setItem('bons-speciaux:location', JSON.stringify(position));
    else localStorage.removeItem('bons-speciaux:location');
    // A new origin requests the nearest stores, not pins saved for the previous origin.
    state.branchChoices = {};
    localStorage.removeItem(`bons-speciaux:branches:${regionId}`);
    renderSelection();
  } catch (error) {
    state.location = previousLocation;
    chooser.value = state.regionId;
    renderWeekHeader();
    throw error;
  } finally {
    chooser.disabled = false; chooser.value = state.regionId; updateLocationCaption();
  }
}
document.querySelector('#region-select').addEventListener('change', async event => {
  if (event.target.value === 'other') {
    event.target.value = state.regionId; regionDropdown?.sync(); locationPicker?.open(); return;
  }
  try { await chooseRegion(event.target.value); }
  catch (error) { console.error('Region loading failed:', error); setExportStatus('Cette région est indisponible pour le moment.', 'warning'); }
});
window.addEventListener('storage', async event => {
  if (event.key !== 'bons-speciaux:location' || !state.week) return;
  try {
    const position = event.newValue ? JSON.parse(event.newValue) : null;
    if (position && !validCoordinates(position)) throw new Error('Position enregistrée invalide.');
    await chooseRegion(position?.regionId || localStorage.getItem('bons-speciaux:region') || state.regionId, position);
  } catch (error) {
    console.error('Shared location update failed:', error);
    setExportStatus('La nouvelle position n’a pas pu être chargée. Utilise « Changer ma position » pour réessayer.', 'warning');
  }
});
setupShoppingWorkspace();
init();
