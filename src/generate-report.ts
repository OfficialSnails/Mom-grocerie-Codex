import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { RawDealItem } from '../sources/source-adapter.js';
import type { Product } from './normalize-product.js';
import { cleanItemName, findMatchingProduct, normalizeString } from './normalize-product.js';
import { normalizePrice, formatPriceFR } from './normalize-price.js';
import { getProductStats } from './price-history.js';
import { scoreDeal } from './deal-score.js';
import { getSkippedSources } from './source-safety.js';
import { obsidianFrontmatter } from './obsidian-style.js';
import {
  FINAL_LIST_FILE,
  LEGACY_FINAL_LIST_FILES,
  LEGACY_PICKER_FILES,
  LEGACY_STORE_SUMMARY_FILES,
  LEGACY_TECHNICAL_DIRS,
  PICKER_FILE,
  STORE_SUMMARY_FILE,
  TECHNICAL_DIR,
  frenchWeekFolderName,
} from './weekly-files.js';
import { enrichDealsWithProofOcr } from './proof-ocr.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_PATH = join(__dirname, '..', 'data', 'products.json');
const REPORTS_DIR = join(__dirname, '..', 'reports');
const HISTORICAL_DIR = join(REPORTS_DIR, 'historical-item');
const MOM_DIR = join(REPORTS_DIR, 'mom-list');
const AUDIT_DIR = join(REPORTS_DIR, 'audit');
const SCORED_DIR = join(REPORTS_DIR, 'scored');
const RAW_DIR = join(REPORTS_DIR, 'raw');
const VERIFIED_DIR = join(REPORTS_DIR, 'verified');
const COMPARE_DIR = join(REPORTS_DIR, 'compare');
const WEEKS_DIR = join(REPORTS_DIR, 'weeks');
const WEBSITE_DIR = join(__dirname, '..', 'website');
const WEBSITE_WEEKS_DIR = join(WEBSITE_DIR, 'data', 'weeks');
const LAST_WEEK_SCORED_PATH = join(__dirname, '..', 'data', 'last-week-scored.json');

function loadProducts(): Product[] {
  if (!existsSync(PRODUCTS_PATH)) return [];
  return JSON.parse(readFileSync(PRODUCTS_PATH, 'utf-8')) as Product[];
}

export interface ScoredDeal extends RawDealItem {
  score: number;
  label: string;
  french_label: string;
  french_reason: string;
  worth_buying: boolean;
  matched_product?: Product;
  normalized_price_per_unit?: number;
  normalized_unit?: string;
  stats_avg?: number | null;
  stats_low?: number | null;
  stats_low30?: number | null;
  // Cross-store comparison (set after dedup)
  cross_store_winner?: boolean;
  cross_store_count?: number;
  cross_store_savings?: number;
  cross_store_competitors?: string[];  // store short-names that also carry this item
  cross_store_competitor_prices?: string[];
}

export interface VerifiedDeal extends ScoredDeal {
  verification_status: 'VERIFIED_FLYER_STRUCTURED' | 'VERIFIED_MANUAL' | 'UNVERIFIED';
  verification_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  verification_reason: string;
}

type ShopperCategoryId =
  | 'produce'
  | 'meat-fish'
  | 'dairy-eggs'
  | 'pantry'
  | 'bakery'
  | 'frozen'
  | 'snacks-drinks';

interface ShopperCategory {
  id: ShopperCategoryId;
  title: string;
  maxItems: number;
}

interface WeeklyPack {
  workingDir: string;
  readme: string;
  finalList: string;
  shoppingPicker: string;
  storeSummary: string;
  fullReport: string;
  audit: string;
  raw: string;
  verified: string;
  scored: string;
  pickerItems: string;
}

const SHOPPER_CATEGORIES: ShopperCategory[] = [
  { id: 'produce', title: 'Fruits et légumes', maxItems: 20 },
  { id: 'meat-fish', title: 'Viandes et poissons', maxItems: 20 },
  { id: 'dairy-eggs', title: 'Produits laitiers et oeufs', maxItems: 20 },
  { id: 'pantry', title: 'Épicerie / garde-manger', maxItems: 20 },
  { id: 'bakery', title: 'Boulangerie', maxItems: 20 },
  { id: 'frozen', title: 'Surgelés', maxItems: 20 },
  { id: 'snacks-drinks', title: 'Collations et boissons', maxItems: 20 },
];

export function scoreAllDeals(items: RawDealItem[]): ScoredDeal[] {
  const products = loadProducts();

  return items.map(item => {
    const matched = item.normalized_name
      ? products.find(p => p.normalized_name === item.normalized_name) ?? findMatchingProduct(item.item_name, products)
      : findMatchingProduct(item.item_name, products);

    const norm = normalizePrice(item.current_price, item.size, item.unit);
    const isStockUp = matched?.is_stock_up_friendly ?? false;

    const lookupName = item.normalized_name ?? matched?.normalized_name ?? item.item_name;
    const stats = getProductStats(lookupName);

    const result = scoreDeal(norm.price_per_unit, stats, isStockUp, item.confidence);

    return {
      ...item,
      score: result.score,
      label: result.label,
      french_label: result.french_label,
      french_reason: result.french_reason,
      worth_buying: result.worth_buying,
      matched_product: matched ?? undefined,
      normalized_price_per_unit: norm.price_per_unit,
      normalized_unit: norm.normalized_unit,
      stats_avg: stats.avg_6mo,
      stats_low: stats.low_6mo,
      stats_low30: stats.low_30d,
    };
  });
}

function deduplicateDeals(deals: ScoredDeal[]): ScoredDeal[] {
  const seen = new Map<string, ScoredDeal>();
  for (const deal of deals) {
    const key = `${deal.normalized_name ?? deal.item_name}::${deal.store_id}`;
    const existing = seen.get(key);
    if (!existing || deal.score > existing.score) seen.set(key, deal);
  }
  return [...seen.values()];
}

// Keywords that indicate non-grocery items to exclude from mom's list
const NON_FOOD_KEYWORDS = [
  // Garden / outdoor
  'plant de', 'patio', 'jardin', 'compost', 'fumier', 'terre ', 'mélange à gazon',
  'fleur', ' tige', 'bulbe', 'semence', 'engrais', 'pot patio', 'pot de fleur',
  'barbecue', 'bbq', 'tondeuse', 'arrosoir', 'bac à fleur', 'hivern',
  'begonia', 'hibiscus', 'géranium', 'pétunia', 'impatiente', 'palmier',
  'annuelles', 'balconni', 'yucca', 'mosquito', 'plante', 'window box',
  'panier suspendu', 'panier victorien', 'panier patio', 'panier fleuri',
  'gazon', 'pelouse', 'fertilisant', 'insecticide', 'herbicide',
  // Household / non-food
  'papier hygiénique', 'papier toilette', 'essuie-tout', 'couche', 'serviette sanitaire',
  'détergent', 'savon à vaisselle', 'nettoyant', 'désinfectant', 'soins pour bébés',
  'sudocrem', 'penaten', 'zincofax', 'assouplisseur', 'fleecy', 'adoucissant',
  'fabric softener',
  // Pet food
  'alpo', 'purina', 'iams', 'pedigree', 'whiskas', 'fancy feast',
  'nourriture pour chien', 'nourriture pour chat', 'litière',
  // Alcohol / SAQ-style drinks not useful for the core grocery list
  'bière', 'beer', 'vin ', 'wine', 'sangria', 'malt', 'cidre', 'cider',
  'vodka', 'whisky', 'whiskey', 'rum', 'rhum', 'gin', 'tequila', 'liqueur',
];

function isFoodItem(deal: ScoredDeal): boolean {
  if (deal.category) {
    const cat = deal.category.toLowerCase();
    if (['jardin', 'garden', 'maison', 'home', 'quincaillerie'].some(c => cat.includes(c))) return false;
  }
  const name = deal.item_name.toLowerCase();
  return !NON_FOOD_KEYWORDS.some(kw => name.includes(kw));
}

function classifyShopperCategory(deal: ScoredDeal): ShopperCategoryId | null {
  const cat = (deal.category ?? '').toLowerCase();
  const name = deal.item_name.toLowerCase();

  if (!isFoodItem(deal)) return null;

  if (
    ['surgelé', 'frozen'].some(k => cat.includes(k)) ||
    ['surgelé', 'surgeles', 'frozen', 'pizza', 'frites', 'corn dog'].some(k => name.includes(k))
  ) return 'frozen';

  if (
    ['fruit', 'fruits', 'légume', 'legume', 'produce'].some(k => cat.includes(k)) ||
    ['fraise', 'bleuet', 'banane', 'pomme', 'concombre', 'laitue', 'salade', 'poivron', 'oignon', 'céleri', 'celeri', 'celery', 'melon', 'rutabaga', 'champignon', 'asperge', 'mûre', 'mure', 'mangue', 'tomate', 'cerise'].some(k => name.includes(k))
  ) return 'produce';

  if (
    ['viande', 'meat', 'poisson', 'fish', 'seafood', 'volaille'].some(k => cat.includes(k)) ||
    ['poulet', 'boeuf', 'bœuf', 'porc', 'poisson', 'saumon', 'crevette', 'thon', 'bacon', 'saucisse', 'roti', 'rôti', 'jambon', 'charcut', 'smoked meat', 'bologne', 'bologna', 'baloney', 'pepperoni', 'chorizo', 'sauciflard', 'rosette', 'salami', 'mortadelle', 'prosciutto', 'viande froide'].some(k => name.includes(k))
  ) return 'meat-fish';

  if (
    ['laitier', 'dairy', 'oeuf', 'egg'].some(k => cat.includes(k)) ||
    ['beurre', 'fromage', 'yogourt', 'yogurt', 'lait', 'oeuf', 'oeufs', 'crème', 'cream', 'mozzarella'].some(k => name.includes(k))
  ) return 'dairy-eggs';

  if (
    ['boulangerie', 'bakery'].some(k => cat.includes(k)) ||
    ['pain', 'bagel', 'baguette', 'croissant', 'hamburger', 'hot dog'].some(k => name.includes(k))
  ) return 'bakery';

  if (
    ['snack', 'boisson', 'drink', 'chips', 'croustilles'].some(k => cat.includes(k)) ||
    ['chips', 'croustilles', 'jus', 'boisson', 'celsius', 'eau ', 'water', 'barres', 'biscuits', 'pretzel', 'gâteau', 'vachon', 'thé glacé'].some(k => name.includes(k))
  ) return 'snacks-drinks';

  return 'pantry';
}

function isPracticalShopperItem(deal: VerifiedDeal): boolean {
  const name = deal.item_name.toLowerCase();
  if (['énergisante', 'energy', 'mocktail', 'atypique', 'boisson au café', 'drinkable yogurt'].some(k => name.includes(k))) return false;
  return classifyShopperCategory(deal) !== null;
}

function canonicalComparisonName(value: string): string {
  return normalizeString(value)
    .replace(/\bor\b.*$/g, ' ')
    .replace(/\bou\b.*$/g, ' ')
    .replace(/\bde boeuf\b/g, ' ')
    .replace(/\bbeef\b/g, ' ')
    .replace(/\bboeuf\b/g, ' ')
    .replace(/\bbuf\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function flyerComparisonBasis(deal: ScoredDeal): string | null {
  if (!deal.source_raw_name) return null;
  const rawParts = deal.source_raw_name.split('|').map(part => part.trim()).filter(Boolean);
  if (rawParts.length === 0) return null;
  return rawParts[1] ?? rawParts[0] ?? null;
}

function comparisonGroupKey(deal: ScoredDeal): string {
  const flyerBasis = flyerComparisonBasis(deal);
  if (flyerBasis) {
    return canonicalComparisonName(flyerBasis);
  }
  if (deal.matched_product?.normalized_name) {
    return canonicalComparisonName(deal.matched_product.normalized_name);
  }
  if (deal.normalized_name) {
    return canonicalComparisonName(deal.normalized_name);
  }
  return canonicalComparisonName(cleanItemName(deal.item_name));
}

function markCrossStoreWinners(deals: ScoredDeal[]): void {
  // Group by normalized item name across all stores
  const byName = new Map<string, ScoredDeal[]>();
  for (const deal of deals) {
    const key = comparisonGroupKey(deal);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(deal);
  }

  for (const group of byName.values()) {
    if (group.length < 2) continue; // only interesting when 2+ stores carry it

    // Keep only the cheapest comparable row per competing store.
    const bestByStore = new Map<string, ScoredDeal>();
    for (const deal of group) {
      const existing = bestByStore.get(deal.store_id);
      const price = deal.normalized_price_per_unit ?? deal.current_price;
      const existingPrice = existing ? (existing.normalized_price_per_unit ?? existing.current_price) : Number.POSITIVE_INFINITY;
      if (!existing || price < existingPrice) {
        bestByStore.set(deal.store_id, deal);
      }
    }

    const distinctGroup = [...bestByStore.values()];
    if (distinctGroup.length < 2) continue;

    // Sort by normalized price per unit (cheapest first); fall back to raw price
    const sorted = [...distinctGroup].sort((a, b) => {
      const pa = a.normalized_price_per_unit ?? a.current_price;
      const pb = b.normalized_price_per_unit ?? b.current_price;
      return pa - pb;
    });

    const winner = sorted[0];
    const runnerUp = sorted[1];
    const winnerPrice = winner.normalized_price_per_unit ?? winner.current_price;
    const runnerPrice = runnerUp.normalized_price_per_unit ?? runnerUp.current_price;

    // Only flag as winner if it's actually cheaper (not just tied)
    if (winnerPrice < runnerPrice) {
      winner.cross_store_winner = true;
      winner.cross_store_count = group.length;
      winner.cross_store_savings = Math.round((runnerPrice - winnerPrice) * 100) / 100;
      // Only list competitors from OTHER stores (exclude winner's own store)
      winner.cross_store_competitors = sorted
        .slice(1)
        .filter(d => d.store_id !== winner.store_id)
        .map(d => STORE_SHORT[d.store_id] ?? d.store_id);
      winner.cross_store_competitor_prices = sorted
        .slice(1)
        .filter(d => d.store_id !== winner.store_id)
        .map(d => `${STORE_SHORT[d.store_id] ?? d.store_id} ${priceWithUnit(d)}`);
    }
  }
}

function frenchDate(d: Date): string {
  return format(d, 'd MMMM yyyy', { locale: fr });
}

function frenchWeekRange(d: Date): string {
  const start = startOfWeek(d, { weekStartsOn: 1 });
  const end = endOfWeek(d, { weekStartsOn: 1 });
  return `${format(start, 'd', { locale: fr })} au ${format(end, 'd MMMM yyyy', { locale: fr })}`;
}

const STORE_ADDRESSES: Record<string, string> = {
  'metro-joliette':       '180 rue Beaudry N, Joliette',
  'maxi-joliette':        '909 boul. Firestone, Joliette',
  'iga-joliette':         '17 rue Gauthier N, Notre-Dame-des-Prairies',
  'superc-joliette':      '1445 boul. Firestone, Joliette',
  'bonichoix-joliette':   '773 rue de Lanaudière, Joliette',
  'intermarche-joliette': 'Joliette',
  'tradition-joliette':   'Joliette',
  'bonichoix-stemilie':   "St-Émilie-de-l'Énergie",
};

const STORE_DISPLAY_NAMES: Record<string, string> = {
  'metro-joliette': 'Metro Joliette',
  'maxi-joliette': 'Maxi Joliette',
  'iga-joliette': 'IGA Joliette',
  'superc-joliette': 'Super C Joliette',
  'bonichoix-joliette': 'BoniChoix Joliette',
  'intermarche-joliette': "L'Inter-Marché Joliette",
  'tradition-joliette': 'Marchés Tradition Joliette',
  'bonichoix-stemilie': "BoniChoix St-Émilie-de-l'Énergie",
};

const ALL_STORE_IDS = [
  'metro-joliette',
  'maxi-joliette',
  'iga-joliette',
  'superc-joliette',
  'bonichoix-joliette',
  'intermarche-joliette',
  'tradition-joliette',
  'bonichoix-stemilie',
];
const STORE_SHORT: Record<string, string> = {
  'metro-joliette': 'Metro',
  'maxi-joliette': 'Maxi',
  'iga-joliette': 'IGA',
  'superc-joliette': 'Super C',
  'bonichoix-joliette': 'BoniChoix Joliette',
  'intermarche-joliette': 'Inter-Marché',
  'tradition-joliette': 'Marchés Tradition',
  'bonichoix-stemilie': 'BoniChoix St-Émilie',
};

function storeName(storeId: string): string {
  return STORE_DISPLAY_NAMES[storeId] ?? storeId;
}

function dealEmoji(label: string): string {
  if (['MUST_BUY', 'STOCK_UP'].includes(label)) return '✅';
  if (label === 'GREAT_DEAL') return '🟢';
  return '🔵';
}

function isBundleLikeOffer(deal: ScoredDeal): boolean {
  const name = deal.item_name.toLowerCase();
  const orCount = (name.match(/\bou\b/g) ?? []).length;
  const commaCount = (name.match(/,/g) ?? []).length;
  return name.length >= 95 || orCount >= 2 || commaCount >= 3;
}

function sourceSystemLabel(deal: ScoredDeal): string {
  if (deal.source_type === 'manual') return 'entrée manuelle';
  if (deal.source_system === 'flipp') return 'circulaire Flipp';
  if (deal.source_system === 'firecrawl') return 'page magasin';
  if (deal.source_system === 'mock') return 'données démo';
  return 'source inconnue';
}

function sourceLinkLabel(deal: ScoredDeal): string {
  if (deal.source_flyer_name) return `circulaire: ${deal.source_flyer_name}`;
  if (deal.source_type === 'manual') return 'source manuelle';
  return 'source';
}

function bestProofUrl(deal: { source_image_url?: string; source_url?: string }): string | undefined {
  return deal.source_image_url ?? deal.source_url;
}

function proofLinkMarkdown(deal: { source_image_url?: string; source_url?: string }, label = 'Voir la preuve'): string | null {
  const url = bestProofUrl(deal);
  return url ? `[${label}](${url})` : null;
}

function proofImageBlock(deal: { item_name?: string; source_image_url?: string; source_url?: string }): string | null {
  const url = bestProofUrl(deal);
  if (!url) return null;
  const alt = deal.item_name ? `Preuve prix ${deal.item_name}` : 'Preuve prix';
  return `<img src="${url}" alt="${alt}" width="220" />`;
}

function proofDisplayLines(deal: { item_name?: string; source_image_url?: string; source_url?: string; source_type?: string }): string[] {
  const proofImage = proofImageBlock(deal);
  if (proofImage) {
    return ['📸 Preuve du prix', proofImage];
  }
  if (deal.source_type === 'manual') {
    return ['⚠️ Preuve photo manquante (entrée manuelle)'];
  }
  return [];
}

function pickerProofDisplayLines(deal: { item_name?: string; source_image_url?: string; source_url?: string; source_type?: string }): string[] {
  const proofImage = proofImageBlock(deal);
  if (proofImage) {
    return ['📸 **Preuve du prix**', proofImage];
  }
  if (deal.source_type === 'manual') {
    return ['⚠️ **Preuve:** photo manquante (entrée manuelle)'];
  }
  return [];
}

function sourceDetailLine(deal: ScoredDeal): string {
  const parts = [`Source: ${sourceSystemLabel(deal)}`, 'prix en CAD'];
  if (deal.sale_start && deal.sale_end) {
    parts.push(`valide ${deal.sale_start.slice(0, 10)} au ${deal.sale_end.slice(0, 10)}`);
  }
  if (isBundleLikeOffer(deal)) {
    parts.push('libellé circulaire groupé');
  }
  if (deal.source_raw_name && deal.source_raw_name !== deal.item_name) {
    parts.push(`texte brut: ${deal.source_raw_name}`);
  }
  const proofLink = proofLinkMarkdown(deal, sourceLinkLabel(deal));
  if (proofLink) {
    parts.push(proofLink);
  }
  return `> ${parts.join(' · ')}`;
}

function isAuditableDeal(deal: ScoredDeal): boolean {
  if (!deal.source_url && deal.source_type !== 'manual') return false;
  if (deal.source_system === 'mock') return false;
  return !isBundleLikeOffer(deal);
}

function parseVerificationPrice(raw?: string): number | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  const multiMatch = cleaned.match(/^(\d+)\s*\/\s*(\d+(?:[.,]\d{1,2})?)$/);
  if (multiMatch) {
    const qty = parseInt(multiMatch[1], 10);
    const total = parseFloat(multiMatch[2].replace(',', '.'));
    if (qty > 0 && !Number.isNaN(total)) return Math.round((total / qty) * 100) / 100;
  }
  const parsed = parseFloat(cleaned.replace(',', '.'));
  return Number.isNaN(parsed) ? null : parsed;
}

function verifyDeal(deal: ScoredDeal): VerifiedDeal {
  if (deal.source_system === 'flipp' && deal.source_type === 'flyer' && deal.source_url && deal.source_raw_name && !isBundleLikeOffer(deal) && isFoodItem(deal)) {
    const parsedRawPrice = parseVerificationPrice(deal.source_raw_price);
    const priceMatches = parsedRawPrice == null || Math.abs(parsedRawPrice - deal.current_price) < 0.011;
    if (priceMatches) {
      return {
        ...deal,
        verification_status: 'VERIFIED_FLYER_STRUCTURED',
        verification_confidence: 'HIGH',
        verification_reason: 'Item alimentaire de circulaire Flipp avec nom brut, prix brut et lien source concordants.',
      };
    }
  }

  if (deal.source_type === 'manual' && isFoodItem(deal) && !isBundleLikeOffer(deal)) {
    return {
      ...deal,
      verification_status: 'VERIFIED_MANUAL',
      verification_confidence: deal.source_url ? 'HIGH' : 'MEDIUM',
      verification_reason: deal.source_url
        ? 'Entrée manuelle avec lien source fourni.'
        : 'Entrée manuelle retenue; confirmation visuelle recommandée.',
    };
  }

  return {
    ...deal,
    verification_status: 'UNVERIFIED',
    verification_confidence: 'LOW',
    verification_reason: !isFoodItem(deal)
      ? 'Exclu: non alimentaire ou hors cible.'
      : isBundleLikeOffer(deal)
        ? 'Exclu: libellé de circulaire groupé ou ambigu.'
        : 'Exclu: source ou preuve insuffisante pour la liste finale.',
  };
}

function priceWithUnit(deal: ScoredDeal): string {
  const price = formatPriceFR(deal.current_price);
  const unit = deal.unit === 'kg'
    ? '/kg'
    : deal.unit === 'lb'
      ? '/lb'
      : deal.unit === '100g'
        ? '/100g'
        : deal.unit === 'L'
          ? '/L'
          : '';
  return `${price}${unit}`;
}

function normalizedPriceLine(deal: ScoredDeal): string | null {
  if (!deal.normalized_price_per_unit || !deal.normalized_unit || deal.normalized_unit === 'unknown') {
    if (deal.unit) return null;
    return deal.source_image_url ? 'Format à vérifier sur la photo.' : 'Format non confirmé.';
  }

  if (deal.unit === 'lb' && deal.normalized_unit === 'kg') {
    return `Équivaut à ${formatPriceFR(deal.normalized_price_per_unit)}/kg.`;
  }

  if (deal.unit === 'g' && deal.normalized_unit === 'kg') {
    if (deal.size === '454' && /1\s*lb|1\s*livre|fraises/i.test(`${deal.notes ?? ''} ${deal.source_raw_name ?? ''} ${deal.item_name}`)) {
      return `Format: paquet de 1 lb. Équivaut à ${formatPriceFR(deal.normalized_price_per_unit)}/kg.`;
    }
    return `Équivaut à ${formatPriceFR(deal.normalized_price_per_unit)}/kg.`;
  }

  if (deal.unit === '100g' && deal.normalized_unit === 'kg') {
    return `Équivaut à ${formatPriceFR(deal.normalized_price_per_unit)}/kg.`;
  }

  if (deal.unit === 'ml' && deal.normalized_unit === 'L') {
    return `Équivaut à ${formatPriceFR(deal.normalized_price_per_unit)}/L.`;
  }

  if (deal.unit === 'each' && deal.size && deal.size !== '1') {
    return `Équivaut à ${formatPriceFR(deal.normalized_price_per_unit)}/unité.`;
  }

  return null;
}

function formatCompactDeal(deal: ScoredDeal): string {
  const emoji = dealEmoji(deal.label);
  const labelSuffix = isLowValueReasonText(deal.french_label) ? '' : `  ·  ${emoji} ${deal.french_label}`;
  const line1 = `**${deal.item_name}** — ${priceWithUnit(deal)}${labelSuffix}`;

  const normUnit = deal.normalized_unit === 'kg' ? '/kg' : deal.normalized_unit === 'L' ? '/L' : '';
  const parts: string[] = [];
  if (deal.stats_avg) {
    parts.push(`Prix habituel : ~${formatPriceFR(deal.stats_avg)}${normUnit}`);
  }
  if (deal.stats_low) {
    parts.push(`meilleur vu : ${formatPriceFR(deal.stats_low)}${normUnit}`);
  }

  const lines = [line1];
  if (parts.length > 0) lines.push(parts.join('  ·  '));
  if (!isLowValueReasonText(deal.french_reason)) {
    lines.push(`*${deal.french_reason}*`);
  }
  lines.push(sourceDetailLine(deal));
  lines.push(...proofDisplayLines(deal));

  return lines.join('\n');
}

function formatNewItem(deal: ScoredDeal): string {
  const lines = [
    `**${deal.item_name}** — ${priceWithUnit(deal)}  ·  ❓ Historique insuffisant`,
    `*Prix clair, mais pas assez d'historique pour comparer.*`,
    sourceDetailLine(deal),
  ];
  lines.push(...proofDisplayLines(deal));
  return lines.join('\n');
}

function formatAvoidLine(deal: ScoredDeal): string {
  const price = priceWithUnit(deal);
  const store = storeName(deal.store_id);
  let context = '';
  if (deal.stats_low30) context = ` · était à ${formatPriceFR(deal.stats_low30)} récemment`;
  else if (deal.stats_low && deal.label === 'WAIT') context = ` · meilleur vu : ${formatPriceFR(deal.stats_low)}`;
  return `- **${deal.item_name}** (${store}) · ${price}${context} → ${deal.french_label}`;
}

export function generateMarkdownReport(
  deals: ScoredDeal[],
  _skippedSourceIds: string[],
  reportDate: Date = new Date(),
  reportVariant = 'live'
): string {
  const unique = deduplicateDeals(deals);
  const worthy = unique.filter(d => d.worth_buying).sort((a, b) => b.score - a.score);
  const newItems = unique.filter(d => ['NOT_ENOUGH_HISTORY', 'LOW_CONFIDENCE'].includes(d.label));
  const badDeals = unique.filter(d =>
    !d.worth_buying && ['FAKE_SALE', 'WAIT', 'SKIP_WEAK_DEAL'].includes(d.label)
  );

  const lines: string[] = [];

  lines.push(`# Bons spéciaux de la semaine — Joliette`);
  lines.push('');
  lines.push(`📅 ${frenchDate(reportDate)}  ·  Semaine du ${frenchWeekRange(reportDate)}`);
  if (reportVariant !== 'live') {
    lines.push(`⚠️ Rapport généré en mode ${reportVariant} — ne remplace pas la meilleure version live.`);
  }
  lines.push(`💲 Tous les prix sont en dollars canadiens (CAD).`);
  lines.push(`🔎 Les liens pointent vers la circulaire ou la source utilisée; ces prix ne sont pas toujours trouvables via la recherche normale du site marchand.`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const storeId of ALL_STORE_IDS) {
    const storeWorthy = worthy.filter(d => d.store_id === storeId);
    const storeNew = newItems.filter(d => d.store_id === storeId);
    const totalCount = storeWorthy.length + storeNew.length;
    const name = storeName(storeId);

    if (storeId === 'bonichoix-stemilie') {
      lines.push(`## 🛒 ${name} — entrée manuelle`);
      lines.push('');
      if (totalCount === 0) {
        lines.push(`*Ajoute les spéciaux BoniChoix dans \`data/current_week_prices.csv\` (pas de site web).*`);
      } else {
        for (const deal of storeWorthy) { lines.push(formatCompactDeal(deal)); lines.push(''); }
        for (const deal of storeNew) { lines.push(formatNewItem(deal)); lines.push(''); }
      }
      lines.push('');
    } else {
      const goodCount = storeWorthy.length;
      const pl = (n: number) => n > 1 ? 'spéciaux' : 'spécial';
      let header: string;
      if (totalCount === 0) {
        header = `## 🛒 ${name} — rien cette semaine`;
      } else if (goodCount > 0 && storeNew.length > 0) {
        header = `## 🛒 ${name} — ${totalCount} ${pl(totalCount)} (${goodCount} bon${goodCount > 1 ? 's' : ''} + ${storeNew.length} à surveiller)`;
      } else if (goodCount > 0) {
        header = `## 🛒 ${name} — ${goodCount > 1 ? `${goodCount} bons spéciaux` : '1 bon spécial'}`;
      } else {
        header = `## 🛒 ${name} — ${totalCount} ${pl(totalCount)} à surveiller`;
      }
      lines.push(header);
      lines.push('');

      if (totalCount === 0) {
        lines.push(`*Aucun spécial trouvé cette semaine.*`);
      } else {
        for (const deal of storeWorthy) { lines.push(formatCompactDeal(deal)); lines.push(''); }
        if (storeNew.length > 0) {
          if (storeWorthy.length > 0) lines.push(`*— Autres spéciaux (pas encore dans la base de prix) —*`);
          for (const deal of storeNew) { lines.push(formatNewItem(deal)); lines.push(''); }
        }
      }
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  if (badDeals.length > 0) {
    lines.push(`## ❌ À éviter cette semaine`);
    lines.push('');
    lines.push(`*Ces articles semblaient en spécial, mais le prix n'est pas avantageux.*`);
    lines.push('');
    for (const deal of badDeals) {
      lines.push(formatAvoidLine(deal));
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  const summaryParts = ALL_STORE_IDS
    .filter(id => worthy.some(d => d.store_id === id) || newItems.some(d => d.store_id === id) || badDeals.some(d => d.store_id === id))
    .map(id => {
      const good = worthy.filter(d => d.store_id === id).length;
      const total = good + newItems.filter(d => d.store_id === id).length;
      const short = STORE_SHORT[id] ?? id;
      return total > 0 ? `${short} : ${good}/${total}` : `${short} : —`;
    });
  lines.push(`📊 ${summaryParts.join('  ·  ')}`);
  lines.push(`*(confirmés bons / total spéciaux)*`);

  lines.push('');
  lines.push(`*Rapport du ${frenchDate(reportDate)} — bons-speciaux v1.0*`);

  return lines.join('\n');
}

const LABEL_RANK: Record<string, number> = {
  MUST_BUY: 0, STOCK_UP: 1, GREAT_DEAL: 2, GOOD_IF_NEEDED: 3,
};

function isNegativeOutcomeLabel(label: string): boolean {
  return ['WAIT', 'FAKE_SALE', 'SKIP_WEAK_DEAL'].includes(label);
}

export function generateMomReport(
  deals: ScoredDeal[],
  reportDate: Date = new Date(),
  topNPerStore = 20,
  reportVariant = 'live'
): string {
  const unique = deduplicateDeals(deals);
  markCrossStoreWinners(unique);

  // Include: confirmed deals + cross-store winners + Flipp-badged + first-time food items
  const allWorthy = unique
    .filter(d =>
      isFoodItem(d) &&
      isAuditableDeal(d) && (
        d.worth_buying ||
        d.cross_store_winner ||
        (d.flipp_discount_pct != null && !isNegativeOutcomeLabel(d.label)) ||
        d.label === 'NOT_ENOUGH_HISTORY'
      )
    )
    .sort((a, b) => {
      // Priority tiers: confirmed > cross-store winner or Flipp badge > premier aperçu
      const tierA = a.worth_buying ? 0 : (a.cross_store_winner || a.flipp_discount_pct) ? 1 : 2;
      const tierB = b.worth_buying ? 0 : (b.cross_store_winner || b.flipp_discount_pct) ? 1 : 2;
      if (tierA !== tierB) return tierA - tierB;
      // Within same tier: sort by label rank then score
      const rankDiff = (LABEL_RANK[a.label] ?? 9) - (LABEL_RANK[b.label] ?? 9);
      return rankDiff !== 0 ? rankDiff : b.score - a.score;
    });

  const lines: string[] = [];
  lines.push(`# 🛒 Spéciaux de la semaine — ${frenchWeekRange(reportDate)}`);
  lines.push(`${frenchDate(reportDate)} · Joliette et région`);
  if (reportVariant !== 'live') {
    lines.push(`⚠️ Version ${reportVariant} — utile pour vérification, pas pour écraser la liste live.`);
  }
  lines.push(`Prix en CAD. Chaque item retenu ci-dessous a une source vérifiable liée à la circulaire ou à l'entrée manuelle.`);
  lines.push('');

  if (allWorthy.length === 0) {
    lines.push('*Aucun spécial confirmé cette semaine — manque d\'historique de prix.*');
    return lines.join('\n');
  }

  let totalDeals = 0;

  for (const storeId of ALL_STORE_IDS) {
    const storeAll = allWorthy.filter(d => d.store_id === storeId);
    // Cap ❓ premier aperçu items at 5 per store — rest of slots go to confirmed/winner/badged
    const confirmed = storeAll.filter(d =>
      d.worth_buying ||
      d.cross_store_winner ||
      (d.flipp_discount_pct != null && !isNegativeOutcomeLabel(d.label))
    );
    const apercu = storeAll.filter(d => !d.worth_buying && !d.cross_store_winner && !d.flipp_discount_pct).slice(0, 5);
    const storeDeals = [...confirmed, ...apercu].slice(0, topNPerStore);
    if (storeDeals.length === 0) continue;

    totalDeals += storeDeals.length;
    const name = storeName(storeId);
    const address = STORE_ADDRESSES[storeId];
    lines.push(`## ${name}`);
    if (address) lines.push(`📍 ${address}`);
    lines.push('');

    storeDeals.forEach((deal, i) => {
      const isNew = deal.label === 'NOT_ENOUGH_HISTORY' && !deal.cross_store_winner;
      const emoji = isNew ? '❓' : dealEmoji(deal.label);
      const price = priceWithUnit(deal);
      const normUnit = deal.normalized_unit === 'kg' ? '/kg' : deal.normalized_unit === 'L' ? '/L' : '';

      const savingAmount = deal.stats_avg && deal.normalized_price_per_unit
        ? deal.stats_avg - deal.normalized_price_per_unit
        : 0;
      const hasMeaningfulSaving = !isNew &&
        deal.label !== 'NOT_ENOUGH_HISTORY' &&
        savingAmount > 0.01;
      const saving = hasMeaningfulSaving
        ? ` · économie ~${formatPriceFR(savingAmount)}${normUnit}`
        : deal.flipp_discount_pct
          ? ` · ${deal.flipp_discount_pct}% de rabais`
          : '';

      // Build the line
      lines.push(`**${i + 1}.** ${emoji} **${deal.item_name}** — ${price}${saving}`);

      // Cross-store winner line with competitor names
      if (deal.cross_store_winner && deal.cross_store_competitors?.length) {
        const competitors = deal.cross_store_competitors.join(', ');
        const savedStr = deal.cross_store_savings
          ? ` · ${formatPriceFR(deal.cross_store_savings)}${normUnit} moins cher`
          : '';
        lines.push(`> 🏆 Meilleur prix vs ${competitors}${savedStr}`);
      }

      // Reason line
      if (!isNew && !isLowValueReasonText(deal.french_reason)) {
        lines.push(`> *${deal.french_reason}*`);
      }
      lines.push(sourceDetailLine(deal));
      lines.push(...proofDisplayLines(deal));

      lines.push('');
    });
  }

  // Footer summary
  const storeSummary = ALL_STORE_IDS
    .filter(id => allWorthy.some(d => d.store_id === id))
    .map(id => {
      const count = allWorthy.filter(d => d.store_id === id).slice(0, topNPerStore).length;
      return `${STORE_SHORT[id] ?? id} : ${count}`;
    });
  lines.push(`---`);
  lines.push(`📊 ${totalDeals} spéciaux · ${storeSummary.join(' · ')}`);
  lines.push(`*Généré le ${frenchDate(reportDate)}*`);

  return lines.join('\n');
}

export function generateVerifiedMomReport(
  deals: ScoredDeal[],
  reportDate: Date = new Date(),
  topNPerStore = 20,
): { markdown: string; shortlist: VerifiedDeal[] } {
  const unique = deduplicateDeals(deals);
  markCrossStoreWinners(unique);

  const verified = unique
    .map(verifyDeal)
    .filter(d => d.verification_status !== 'UNVERIFIED')
    .sort((a, b) => {
      const tierA = a.worth_buying ? 0 : a.cross_store_winner ? 1 : a.label === 'NOT_ENOUGH_HISTORY' ? 3 : 2;
      const tierB = b.worth_buying ? 0 : b.cross_store_winner ? 1 : b.label === 'NOT_ENOUGH_HISTORY' ? 3 : 2;
      if (tierA !== tierB) return tierA - tierB;
      const rankDiff = (LABEL_RANK[a.label] ?? 9) - (LABEL_RANK[b.label] ?? 9);
      return rankDiff !== 0 ? rankDiff : b.score - a.score;
    });

  const shortlist: VerifiedDeal[] = [];
  const lines: string[] = [];
  lines.push(`# 🧾 Liste vérifiée — ${frenchWeekRange(reportDate)}`);
  lines.push(`${frenchDate(reportDate)} · Joliette et région`);
  lines.push(`Prix en CAD. Cette liste finale ne garde que les items alimentaires avec preuve structurée suffisante pour un achat réel.`);
  lines.push('');

  for (const storeId of ALL_STORE_IDS) {
    const storePool = verified.filter(d => d.store_id === storeId);
    const strong = storePool.filter(d =>
      d.worth_buying ||
      (
        d.cross_store_winner &&
        !isNegativeOutcomeLabel(d.label) &&
        (d.cross_store_savings ?? 0) >= 0.25
      )
    );
    const highDiscountNew = storePool
      .filter(d =>
        d.label === 'NOT_ENOUGH_HISTORY' &&
        !d.cross_store_winner &&
        (d.flipp_discount_pct ?? 0) >= 25
      )
      .slice(0, 5);

    const seenKeys = new Set<string>();
    const storeDeals = [...strong, ...highDiscountNew]
      .filter(deal => {
        const key = `${deal.store_id}::${deal.normalized_name ?? deal.item_name}`;
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      })
      .slice(0, topNPerStore);

    if (storeDeals.length === 0) continue;
    shortlist.push(...storeDeals);

    lines.push(`## ${storeName(storeId)}`);
    if (STORE_ADDRESSES[storeId]) lines.push(`📍 ${STORE_ADDRESSES[storeId]}`);
    lines.push('');

    storeDeals.forEach((deal, index) => {
      const emoji = deal.label === 'NOT_ENOUGH_HISTORY' ? '❓' : dealEmoji(deal.label);
      lines.push(`**${index + 1}.** ${emoji} **${deal.item_name}** — ${priceWithUnit(deal)}`);

      if (deal.cross_store_winner && deal.cross_store_competitor_prices?.length) {
        lines.push(`> 🏆 Choix gagnant: moins cher que ${deal.cross_store_competitor_prices.join(' · ')}`);
      } else if (deal.cross_store_competitors?.length) {
        lines.push(`> 🏪 Aussi vu chez ${deal.cross_store_competitors.join(', ')}`);
      }

      const reason = usefulDealReasonLine(deal);
      if (reason) lines.push(`> *${reason}*`);
      lines.push(`> Vérification: ${deal.verification_status} · ${deal.verification_reason}`);
      lines.push(...proofDisplayLines(deal));
      if (deal.source_raw_name && deal.source_raw_name !== deal.item_name) {
        lines.push(`> Texte source: ${deal.source_raw_name}`);
      }
      lines.push('');
    });
  }

  if (shortlist.length === 0) {
    lines.push(`*Aucun item n'a passé la vérification stricte cette semaine.*`);
  }

  lines.push('---');
  lines.push(`📊 ${shortlist.length} items retenus pour achat réel`);
  lines.push(`*Liste finale vérifiée générée le ${frenchDate(reportDate)}.*`);

  return { markdown: lines.join('\n'), shortlist };
}

function shopperPriority(deal: VerifiedDeal): [number, number, number, number] {
  const strongTier = deal.worth_buying ? 0 : deal.cross_store_winner ? 1 : 2;
  const labelRank = LABEL_RANK[deal.label] ?? 9;
  const inverseSavings = -1 * (deal.cross_store_savings ?? 0);
  return [strongTier, labelRank, inverseSavings, -deal.score];
}

function sortDealsForShopper(a: VerifiedDeal, b: VerifiedDeal): number {
  const pa = shopperPriority(a);
  const pb = shopperPriority(b);
  for (let i = 0; i < pa.length; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return a.item_name.localeCompare(b.item_name, 'fr');
}

function dealReasonLine(deal: VerifiedDeal): string {
  return deal.label === 'NOT_ENOUGH_HISTORY'
    ? 'Premier aperçu retenu, prix clair et source vérifiée'
    : deal.french_reason;
}

function isLowValueReasonText(reason: string): boolean {
  const rawLower = reason.toLowerCase();
  const normalized = normalizeString(reason)
    .replace(/[.。]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    rawLower.includes('premier aperçu') ||
    rawLower.includes('premier apercu') ||
    rawLower.includes('bon prix si tu en as besoin') ||
    normalized.includes('premier apercu') ||
    normalized.includes('prix clair et source verifiee') ||
    normalized.includes('bon prix si tu en as besoin')
  );
}

function usefulDealReasonLine(deal: VerifiedDeal): string | null {
  const reason = dealReasonLine(deal).trim();
  return isLowValueReasonText(reason) ? null : reason;
}

function comparisonLines(deal: VerifiedDeal): string[] {
  if (!deal.cross_store_winner || !deal.cross_store_competitor_prices?.length) {
    return [];
  }

  const nextBest = deal.cross_store_competitor_prices[0];
  const lines = [`📊 Gagne contre ${nextBest}`];

  if (deal.cross_store_savings && deal.cross_store_savings > 0) {
    const unit = deal.normalized_unit === 'kg' ? '/kg' : deal.normalized_unit === 'L' ? '/L' : '';
    lines.push(`🏅 Pourquoi ça gagne: ${formatPriceFR(deal.cross_store_savings)}${unit} moins cher que le prochain meilleur prix`);
  }

  if (deal.cross_store_competitor_prices.length > 1) {
    const preview = deal.cross_store_competitor_prices.slice(0, 6);
    const remainder = deal.cross_store_competitor_prices.length - preview.length;
    const suffix = remainder > 0 ? ` · + ${remainder} autres` : '';
    lines.push(`🧾 Autres prix vus: ${preview.join(' · ')}${suffix}`);
  }

  return lines;
}

function categoryEmoji(id: ShopperCategoryId): string {
  switch (id) {
    case 'produce': return '🥬';
    case 'meat-fish': return '🥩';
    case 'dairy-eggs': return '🥛';
    case 'pantry': return '🥫';
    case 'bakery': return '🥖';
    case 'frozen': return '🧊';
    case 'snacks-drinks': return '🍪';
  }
}

function shopperDedupKey(deal: VerifiedDeal): string {
  const familyText = normalizeString(`${deal.normalized_name ?? ''} ${deal.item_name}`);
  if (familyText.includes('chorizo') && familyText.includes('sauciflard')) {
    return 'sauciflard-chorizo';
  }
  if (familyText.includes('rosette') && familyText.includes('boeuf')) {
    return 'rosettes-boeuf';
  }
  if (familyText.includes('bologne') || familyText.includes('bologna') || familyText.includes('baloney')) {
    return 'bologne';
  }
  if ((familyText.includes('boeuf') || familyText.includes('bœuf') || familyText.includes('buf')) && familyText.includes('hach') && familyText.includes('extra')) {
    return 'boeuf-hache-extra-maigre';
  }

  if (deal.matched_product?.normalized_name) {
    return normalizeString(deal.matched_product.normalized_name);
  }
  if (deal.normalized_name) {
    return normalizeString(deal.normalized_name);
  }
  return normalizeString(cleanItemName(deal.item_name));
}

function pickCategoryWinners(shortlist: VerifiedDeal[]): Map<ShopperCategoryId, VerifiedDeal[]> {
  const byCategory = new Map<ShopperCategoryId, VerifiedDeal[]>();

  for (const config of SHOPPER_CATEGORIES) {
    const ranked = shortlist
      .filter(isPracticalShopperItem)
      .filter(deal => classifyShopperCategory(deal) === config.id)
      .sort(sortDealsForShopper);

    const seenKeys = new Set<string>();
    const selected: VerifiedDeal[] = [];
    for (const deal of ranked) {
      const key = shopperDedupKey(deal);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      selected.push(deal);
      if (selected.length >= config.maxItems) break;
    }

    byCategory.set(config.id, selected);
  }

  return byCategory;
}

function buildTripSummary(selectedDeals: VerifiedDeal[]): string[] {
  const byStore = new Map<string, VerifiedDeal[]>();
  for (const deal of selectedDeals) {
    if (!byStore.has(deal.store_id)) byStore.set(deal.store_id, []);
    byStore.get(deal.store_id)!.push(deal);
  }

  const rankedStores = [...byStore.entries()]
    .map(([storeId, deals]) => ({
      storeId,
      deals,
      categories: new Set(deals.map(d => classifyShopperCategory(d))).size,
    }))
    .sort((a, b) => b.deals.length - a.deals.length || b.categories - a.categories);

  const lines: string[] = [];
  if (rankedStores.length === 0) return lines;

  const bestOneStore = rankedStores[0];
  lines.push(`- ⭐ **Meilleur arrêt unique:** ${storeName(bestOneStore.storeId)} pour ${bestOneStore.deals.length} items`);

  if (rankedStores.length > 1) {
    const bestSplit = rankedStores.slice(0, 2);
    const splitCount = bestSplit.reduce((sum, row) => sum + row.deals.length, 0);
    lines.push(`- 🚗 **Meilleur trajet en 2 arrêts:** ${storeName(bestSplit[0].storeId)} + ${storeName(bestSplit[1].storeId)} pour ${splitCount} items`);
  }

  lines.push('');
  lines.push('### 🛒 Aller à quel magasin');
  lines.push('');
  for (const row of rankedStores) {
    lines.push(`#### ${storeName(row.storeId)}`);
    for (const deal of row.deals) {
      lines.push(`- ${deal.item_name}`);
    }
    lines.push('');
  }

  return lines;
}

function pickerDealId(deal: VerifiedDeal, reportDate: Date): string {
  const dateStr = format(reportDate, 'yyyy-MM-dd');
  return `${dateStr}::${deal.store_id}::${shopperDedupKey(deal)}`;
}

export function generateShoppingPickerReport(
  shortlist: VerifiedDeal[],
  reportDate: Date = new Date(),
): { markdown: string; items: Array<{ id: string; item_name: string; store_id: string; store_name: string; price: string; category: string }> } {
  const categoryWinners = pickCategoryWinners(shortlist);
  const lines: string[] = [];
  const items: Array<{ id: string; item_name: string; store_id: string; store_name: string; price: string; category: string }> = [];

  lines.push(obsidianFrontmatter(`Sélection de course — ${frenchWeekRange(reportDate)}`, 'picker').trimEnd());
  lines.push(`# ✅ Sélection de course — ${frenchWeekRange(reportDate)}`);
  lines.push(`${frenchDate(reportDate)} · Coche ce que tu veux acheter. La liste finale se met à jour automatiquement.`);
  lines.push('');
  lines.push(`## Sections`);
  lines.push('');
  for (const config of SHOPPER_CATEGORIES) {
    const deals = categoryWinners.get(config.id) ?? [];
    if (deals.length === 0) continue;
    lines.push(`- [[#${categoryEmoji(config.id)} ${config.title}|${categoryEmoji(config.id)} ${config.title}]]`);
  }
  lines.push('');

  for (const config of SHOPPER_CATEGORIES) {
    const deals = categoryWinners.get(config.id) ?? [];
    if (deals.length === 0) continue;

    lines.push(`## ${categoryEmoji(config.id)} ${config.title}`);
    lines.push('');
    for (const deal of deals) {
      const id = pickerDealId(deal, reportDate);
      items.push({
        id,
        item_name: deal.item_name,
        store_id: deal.store_id,
        store_name: storeName(deal.store_id),
        price: priceWithUnit(deal),
        category: config.title,
      });
      lines.push(`- [ ] **${deal.item_name}** — **${priceWithUnit(deal)}**`);
      lines.push(`  - 📍 **Magasin:** ${storeName(deal.store_id)}`);
      const scale = normalizedPriceLine(deal);
      if (scale) lines.push(`  - ⚖️ **Échelle:** ${scale}`);
      const reason = usefulDealReasonLine(deal);
      if (reason) lines.push(`  - ✅ **Pourquoi:** ${reason}`);
      for (const line of comparisonLines(deal)) {
        lines.push(`  - ${line}`);
      }
      for (const line of pickerProofDisplayLines(deal)) {
        if (line.startsWith('<img')) {
          lines.push(`    ${line}`);
        } else {
          lines.push(`  - ${line}`);
        }
      }
      lines.push('');
    }
    lines.push('');
  }

  return { markdown: lines.join('\n'), items };
}

function generateEmptyFinalListReport(reportDate: Date = new Date()): string {
  return [
    obsidianFrontmatter(`Liste finale — ${frenchWeekRange(reportDate)}`, 'final').trimEnd(),
    `# 🧾 Liste finale — ${frenchWeekRange(reportDate)}`,
    '',
    `Aucun item sélectionné pour le moment.`,
    '',
    `Coche des items dans \`${PICKER_FILE}\`.`,
    `Ce fichier se met à jour automatiquement et regroupe les choix par magasin.`,
  ].join('\n');
}

export function generateShoppingListReport(
  shortlist: VerifiedDeal[],
  reportDate: Date = new Date(),
): string {
  const categoryWinners = pickCategoryWinners(shortlist);
  const chosenDeals = SHOPPER_CATEGORIES.flatMap(config => categoryWinners.get(config.id) ?? []);
  const lines: string[] = [];

  lines.push(`# 🛒 Liste d'épicerie — ${frenchWeekRange(reportDate)}`);
  lines.push(`${frenchDate(reportDate)} · Joliette et région`);
  lines.push(`Lis ce fichier en premier. Chaque item indique le magasin, le prix, pourquoi il est bon et une preuve visuelle du prix quand elle existe.`);
  lines.push('');

  for (const config of SHOPPER_CATEGORIES) {
    const deals = categoryWinners.get(config.id) ?? [];
    if (deals.length === 0) continue;

    lines.push(`## ${categoryEmoji(config.id)} ${config.title}`);
    lines.push(`*Les meilleurs choix de cette section seulement. S'il n'y a rien, on n'invente pas de deal.*`);
    lines.push('');
    for (const deal of deals) {
      lines.push(`### ${deal.item_name}`);
      lines.push('');
      lines.push(`- 📍 **Magasin:** ${storeName(deal.store_id)}`);
      lines.push(`- 💵 **Prix gagnant:** ${priceWithUnit(deal)}`);
      const scale = normalizedPriceLine(deal);
      if (scale) lines.push(`- ⚖️ **Échelle:** ${scale}`);
      const reason = usefulDealReasonLine(deal);
      if (reason) lines.push(`- ✅ **Pourquoi c'est bon:** ${reason}`);
      for (const line of comparisonLines(deal)) {
        lines.push(`- ${line}`);
      }
      for (const line of proofDisplayLines(deal)) {
        lines.push(`- ${line}`);
      }
      lines.push('');
    }
  }

  lines.push(`## 🚗 Plan de course`);
  lines.push('');
  if (chosenDeals.length === 0) {
    lines.push(`- Aucun deal assez solide cette semaine pour recommander un trajet précis.`);
  } else {
    lines.push(...buildTripSummary(chosenDeals));
  }

  lines.push('');
  lines.push(`*Seulement les deals retenus comme réalistes pour une vraie course apparaissent ici. S'il n'y a pas de deal solide dans une section, elle est omise.*`);
  return lines.join('\n');
}

export function generateStoreSummaryReport(
  shortlist: VerifiedDeal[],
  reportDate: Date = new Date(),
): string {
  const categoryWinners = pickCategoryWinners(shortlist);
  const chosenDeals = SHOPPER_CATEGORIES.flatMap(config => categoryWinners.get(config.id) ?? []);
  const grouped = new Map<string, VerifiedDeal[]>();
  for (const deal of chosenDeals.filter(isPracticalShopperItem).sort(sortDealsForShopper)) {
    if (!grouped.has(deal.store_id)) grouped.set(deal.store_id, []);
    grouped.get(deal.store_id)!.push(deal);
  }

  const lines: string[] = [];
  lines.push(obsidianFrontmatter(`Résumé par magasin — ${frenchWeekRange(reportDate)}`, 'summary').trimEnd());
  lines.push(`# 🏬 Résumé par magasin — ${frenchWeekRange(reportDate)}`);
  lines.push(`${frenchDate(reportDate)} · Référence par magasin seulement.`);
  lines.push(`Pour choisir des items, utilise \`${PICKER_FILE}\`. Ce fichier évite de dupliquer les cases.`);
  lines.push('');

  for (const storeId of ALL_STORE_IDS) {
    const deals = grouped.get(storeId) ?? [];
    if (deals.length === 0) continue;
    lines.push('---');
    lines.push('');
    lines.push(`## 🏬 ${storeName(storeId)}`);
    const itemCount = deals.length > 1 ? `${deals.length} items retenus` : `1 item retenu`;
    lines.push(`> [!info] ${itemCount}`);
    if (STORE_ADDRESSES[storeId]) lines.push(`> 📍 ${STORE_ADDRESSES[storeId]}`);
    lines.push('');
    for (const deal of deals) {
      const category = SHOPPER_CATEGORIES.find(c => c.id === classifyShopperCategory(deal))?.title ?? 'Autres';
      lines.push(`- **${deal.item_name}**`);
      lines.push(`  - ${categoryEmoji(classifyShopperCategory(deal) ?? 'pantry')} Section: ${category}`);
      lines.push(`  - Prix: ${priceWithUnit(deal)}`);
      const scale = normalizedPriceLine(deal);
      if (scale) lines.push(`  - Échelle: ${scale}`);
      const reason = usefulDealReasonLine(deal);
      if (reason) lines.push(`  - Pourquoi: ${reason}`);
      for (const line of comparisonLines(deal)) {
        lines.push(`  - ${line}`);
      }
      for (const line of proofDisplayLines(deal)) {
        lines.push(`  ${line}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateWeeklyPackReadme(weekFolderName: string): string {
  return [
    `# ${weekFolderName}`,
    '',
    `Ouvre ces fichiers dans cet ordre:`,
    '',
    `1. \`../${FINAL_LIST_FILE}\` — liste finale automatique; coche ici pour enlever un item`,
    `2. \`../${PICKER_FILE}\` — sélection principale pour ajouter ou enlever des items`,
    `3. \`../${STORE_SUMMARY_FILE}\` — résumé par magasin en lecture seule`,
    `4. \`full-report.md\` — version complète`,
    '',
    `Prix: tous les montants sont en CAD. Quand l'unité est connue, elle apparaît dans le prix (\`/lb\`, \`/kg\`, \`/L\`). Les items au poids peuvent aussi afficher l'équivalent au kg.`,
    '',
    `Rayons: chaque section peut contenir jusqu'à 20 items, mais seulement si les prix sont réels, vérifiables, alimentaires, utiles et non redondants. Une section courte veut dire qu'il n'y avait pas assez de bons prix solides cette semaine.`,
    '',
    `Classification: céleri est traité comme fruits/légumes. Poisson pané et viandes froides sont traités comme viandes/poissons. Pizza est traitée comme surgelé même si le nom contient tomate. Bologne/bologna, pepperoni, chorizo, rosette, sauciflard, salami, mortadelle et prosciutto sont traités comme viandes, même si la source les classe en épicerie/garde-manger.`,
    '',
    `Déduplication: les familles évidentes comme bologne, sauciflard/chorizo et boeuf haché extra maigre gardent seulement le meilleur représentant. Les rosettes de boeuf restent une famille séparée.`,
    '',
    `Format visuel: dans \`${PICKER_FILE}\`, un sommaire de sections apparaît en haut, puis chaque section utilise du Markdown standard. Chaque item affiche \`- [ ] **Item** — **Prix**\`, puis le magasin, l'échelle, la raison et les comparaisons sous l'item. Les preuves photo restent ouvertes directement dans le fichier.`,
    '',
    `Les fichiers de ce dossier \`${TECHNICAL_DIR}/\` servent à l'audit et au débogage.`,
  ].join('\n');
}

function websiteSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function writeWebsiteExport(shortlist: VerifiedDeal[], reportDate: Date, weekFolderName: string): { slug: string; weekJsonPath: string } {
  const slug = websiteSlug(weekFolderName);
  const weekDir = join(WEBSITE_WEEKS_DIR, slug);
  mkdirSync(weekDir, { recursive: true });

  const categoryWinners = pickCategoryWinners(shortlist);
  const categories = SHOPPER_CATEGORIES
    .map(config => {
      const deals = categoryWinners.get(config.id) ?? [];
      return {
        id: config.id,
        title: config.title,
        emoji: categoryEmoji(config.id),
        items: deals.map(deal => ({
          id: pickerDealId(deal, reportDate),
          name: deal.item_name,
          normalizedName: deal.normalized_name ?? null,
          categoryId: config.id,
          categoryTitle: config.title,
          categoryEmoji: categoryEmoji(config.id),
          storeId: deal.store_id,
          storeName: storeName(deal.store_id),
          storeAddress: STORE_ADDRESSES[deal.store_id] ?? '',
          price: priceWithUnit(deal),
          currentPrice: deal.current_price,
          unit: deal.unit ?? null,
          scale: normalizedPriceLine(deal),
          reason: usefulDealReasonLine(deal),
          comparisons: comparisonLines(deal),
          proofImageUrl: deal.source_image_url ?? null,
          proofUrl: bestProofUrl(deal) ?? null,
          sourceType: deal.source_type ?? null,
          sourceSystem: deal.source_system ?? null,
          saleStart: deal.sale_start ?? null,
          saleEnd: deal.sale_end ?? null,
          verificationConfidence: deal.verification_confidence,
          verificationStatus: deal.verification_status,
        })),
      };
    })
    .filter(category => category.items.length > 0);

  const stores = ALL_STORE_IDS
    .map(storeId => ({
      id: storeId,
      name: storeName(storeId),
      address: STORE_ADDRESSES[storeId] ?? '',
      itemCount: categories.reduce((sum, category) => sum + category.items.filter(item => item.storeId === storeId).length, 0),
    }))
    .filter(store => store.itemCount > 0);

  const itemCount = categories.reduce((sum, category) => sum + category.items.length, 0);
  const week = {
    schemaVersion: 1,
    slug,
    folderName: weekFolderName,
    title: `Liste d'épicerie — ${frenchWeekRange(reportDate)}`,
    weekRange: frenchWeekRange(reportDate),
    generatedAt: reportDate.toISOString(),
    itemCount,
    method: {
      title: 'D’où viennent les choix',
      sourceSummary: `Prix en CAD tirés des circulaires et données structurées disponibles pour ${stores.map(store => store.name).join(', ')}.`,
      selectionSummary: `Chaque rayon peut afficher jusqu’à ${Math.max(...SHOPPER_CATEGORIES.map(category => category.maxItems))} bons prix, mais seulement si les items sont alimentaires, vérifiables, utiles pour une vraie course et non redondants.`,
      noPaddingSummary: `Si un rayon contient peu d’items, c’est qu’il n’y avait pas assez de bons prix solides cette semaine; le système n’ajoute pas de faux deals pour remplir la page.`,
    },
    categories,
    stores,
  };

  const weekJsonPath = join(weekDir, 'week.json');
  writeFileSync(weekJsonPath, JSON.stringify(week, null, 2), 'utf-8');

  const indexPath = join(WEBSITE_WEEKS_DIR, 'index.json');
  const existing = existsSync(indexPath)
    ? JSON.parse(readFileSync(indexPath, 'utf-8')) as { weeks?: Array<Record<string, unknown>> }
    : { weeks: [] };
  const weeks = Array.isArray(existing.weeks) ? existing.weeks : [];
  const nextWeek = {
    slug,
    folderName: weekFolderName,
    title: week.title,
    weekRange: week.weekRange,
    generatedAt: week.generatedAt,
    itemCount,
    path: `data/weeks/${slug}/week.json`,
  };
  const nextWeeks = [nextWeek, ...weeks.filter(week => week.slug !== slug)]
    .sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)));
  writeFileSync(indexPath, JSON.stringify({ generatedAt: reportDate.toISOString(), weeks: nextWeeks }, null, 2), 'utf-8');

  return { slug, weekJsonPath };
}

function generateComparisonReport(
  originalMom: string,
  verifiedDeals: VerifiedDeal[],
  reportDate: Date,
): string {
  const originalItems = (originalMom.match(/^\*\*\d+\.\*\*/gm) ?? []).length;
  const verifiedByStore = ALL_STORE_IDS
    .map(id => ({ id, count: verifiedDeals.filter(d => d.store_id === id).length }))
    .filter(row => row.count > 0);

  const lines: string[] = [];
  lines.push(`# Comparaison des listes — ${frenchWeekRange(reportDate)}`);
  lines.push('');
  lines.push(`- Ancienne liste mom: ${originalItems} lignes`);
  lines.push(`- Liste vérifiée: ${verifiedDeals.length} lignes`);
  lines.push(`- Différence: ${originalItems - verifiedDeals.length >= 0 ? '-' : '+'}${Math.abs(originalItems - verifiedDeals.length)} lignes`);
  lines.push('');
  lines.push(`## Répartition vérifiée`);
  lines.push('');
  for (const row of verifiedByStore) {
    lines.push(`- ${storeName(row.id)}: ${row.count}`);
  }
  lines.push('');
  lines.push(`## Statut`);
  lines.push('');
  lines.push(`- La liste vérifiée exclut les non-alimentaires, les libellés groupés ambigus et les items sans preuve structurée suffisante.`);
  lines.push(`- Cette version est la meilleure candidate pour l'usage réel par ta mère.`);
  return lines.join('\n');
}

export async function generateReport(
  items: RawDealItem[],
  options?: { reportVariant?: string }
): Promise<{ filepath: string; momFilepath: string; auditFilepath: string; verifiedMomFilepath: string; comparisonFilepath: string; rawFilepath: string; verifiedJsonFilepath: string; shoppingListFilepath: string; storeSummaryFilepath: string; weeklyPackDir: string; scored: ScoredDeal[] }> {
  const scored = scoreAllDeals(items);
  const skipped = getSkippedSources();
  const now = new Date();
  const reportVariant = options?.reportVariant ?? 'live';

  if (!existsSync(HISTORICAL_DIR)) mkdirSync(HISTORICAL_DIR, { recursive: true });
  if (!existsSync(MOM_DIR)) mkdirSync(MOM_DIR, { recursive: true });
  if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });
  if (!existsSync(SCORED_DIR)) mkdirSync(SCORED_DIR, { recursive: true });
  if (!existsSync(RAW_DIR)) mkdirSync(RAW_DIR, { recursive: true });
  if (!existsSync(VERIFIED_DIR)) mkdirSync(VERIFIED_DIR, { recursive: true });
  if (!existsSync(COMPARE_DIR)) mkdirSync(COMPARE_DIR, { recursive: true });
  if (!existsSync(WEEKS_DIR)) mkdirSync(WEEKS_DIR, { recursive: true });

  const dateStr = format(now, 'yyyy-MM-dd');
  const suffix = reportVariant === 'live' ? '' : `-${reportVariant}`;
  const weekFolderName = reportVariant === 'live'
    ? frenchWeekFolderName(now)
    : `${frenchWeekFolderName(now)} - ${suffix.replace(/^-/, '')}`;
  const weeklyPackDir = join(WEEKS_DIR, weekFolderName);
  if (!existsSync(weeklyPackDir)) mkdirSync(weeklyPackDir, { recursive: true });
  const weeklyWorkingDir = join(weeklyPackDir, TECHNICAL_DIR);
  if (!existsSync(weeklyWorkingDir)) mkdirSync(weeklyWorkingDir, { recursive: true });

  const obsoleteRootFiles = [
    'README.md',
    ...LEGACY_PICKER_FILES,
    ...LEGACY_FINAL_LIST_FILES,
    ...LEGACY_STORE_SUMMARY_FILES,
    FINAL_LIST_FILE,
    PICKER_FILE,
    STORE_SUMMARY_FILE,
    'full-report.md',
    'comparison.md',
    'audit.json',
    'raw-items.json',
    'verified-shortlist.json',
    'scored.json',
    'picker-items.json',
    'shopping-list-reference.md',
  ];
  for (const filename of obsoleteRootFiles) {
    rmSync(join(weeklyPackDir, filename), { force: true });
  }
  for (const dirname of LEGACY_TECHNICAL_DIRS) {
    rmSync(join(weeklyPackDir, dirname), { recursive: true, force: true });
  }
  for (const filename of ['shopping-list-reference.md', 'comparison.md']) {
    rmSync(join(weeklyWorkingDir, filename), { force: true });
  }

  // Full report — all items, all stores
  const fullReport = generateMarkdownReport(scored, skipped, now, reportVariant);
  const filepath = join(HISTORICAL_DIR, `bons-speciaux-joliette-${dateStr}${suffix}-complet.md`);
  writeFileSync(filepath, fullReport, 'utf-8');

  // Mom report — top 20 per store
  const momReport = generateMomReport(scored, now, 20, reportVariant);
  const momFilepath = join(MOM_DIR, `bons-speciaux-joliette-${dateStr}${suffix}-top20.md`);
  writeFileSync(momFilepath, momReport, 'utf-8');

  let { markdown: verifiedMomReport, shortlist } = generateVerifiedMomReport(scored, now, 20);
  shortlist = enrichDealsWithProofOcr(shortlist);
  verifiedMomReport = generateVerifiedMomReport(shortlist, now, 20).markdown;
  const verifiedMomFilepath = join(VERIFIED_DIR, `bons-speciaux-joliette-${dateStr}${suffix}-verified-top20.md`);
  writeFileSync(verifiedMomFilepath, verifiedMomReport, 'utf-8');

  const comparisonReport = generateComparisonReport(momReport, shortlist, now);
  const comparisonFilepath = join(COMPARE_DIR, `bons-speciaux-joliette-${dateStr}${suffix}-comparison.md`);
  writeFileSync(comparisonFilepath, comparisonReport, 'utf-8');

  const rawFilepath = join(RAW_DIR, `bons-speciaux-joliette-${dateStr}${suffix}-raw-items.json`);
  writeFileSync(rawFilepath, JSON.stringify(items, null, 2), 'utf-8');

  const auditPayload = scored.map(deal => ({
    store_id: deal.store_id,
    store_name: deal.store_name,
    item_name: deal.item_name,
    source_raw_name: deal.source_raw_name ?? null,
    current_price_cad: deal.current_price,
    regular_price_cad: deal.regular_price ?? null,
    size: deal.size ?? null,
    unit: deal.unit ?? null,
    score: deal.score,
    label: deal.label,
    french_label: deal.french_label,
    french_reason: deal.french_reason,
    worth_buying: deal.worth_buying,
    auditable_for_mom: isAuditableDeal(deal),
    bundle_like_offer: isBundleLikeOffer(deal),
    source_system: deal.source_system ?? null,
    source_type: deal.source_type ?? null,
    source_url: deal.source_url ?? null,
    source_image_url: deal.source_image_url ?? null,
    source_flyer_id: deal.source_flyer_id ?? null,
    source_flyer_name: deal.source_flyer_name ?? null,
    source_item_id: deal.source_item_id ?? null,
    source_raw_price: deal.source_raw_price ?? null,
    sale_start: deal.sale_start ?? null,
    sale_end: deal.sale_end ?? null,
    flipp_discount_pct: deal.flipp_discount_pct ?? null,
    normalized_name: deal.normalized_name ?? null,
    normalized_price_per_unit: deal.normalized_price_per_unit ?? null,
    normalized_unit: deal.normalized_unit ?? null,
  }));
  const auditFilepath = join(AUDIT_DIR, `bons-speciaux-joliette-${dateStr}${suffix}-audit.json`);
  writeFileSync(auditFilepath, JSON.stringify(auditPayload, null, 2), 'utf-8');

  const verifiedJsonFilepath = join(VERIFIED_DIR, `bons-speciaux-joliette-${dateStr}${suffix}-verified-shortlist.json`);
  writeFileSync(verifiedJsonFilepath, JSON.stringify(shortlist, null, 2), 'utf-8');

  const scoredPayload = {
    generated_at: now.toISOString(),
    report_variant: reportVariant,
    week_label: frenchWeekRange(now),
    deals: scored,
  };
  const scoredFilepath = join(SCORED_DIR, `bons-speciaux-joliette-${dateStr}${suffix}-scored.json`);
  writeFileSync(scoredFilepath, JSON.stringify(scoredPayload, null, 2), 'utf-8');
  writeFileSync(LAST_WEEK_SCORED_PATH, JSON.stringify(scoredPayload, null, 2), 'utf-8');

  const weeklyPack: WeeklyPack = {
    workingDir: weeklyWorkingDir,
    readme: join(weeklyWorkingDir, 'README.md'),
    finalList: join(weeklyPackDir, FINAL_LIST_FILE),
    shoppingPicker: join(weeklyPackDir, PICKER_FILE),
    storeSummary: join(weeklyPackDir, STORE_SUMMARY_FILE),
    fullReport: join(weeklyWorkingDir, 'full-report.md'),
    audit: join(weeklyWorkingDir, 'audit.json'),
    raw: join(weeklyWorkingDir, 'raw-items.json'),
    verified: join(weeklyWorkingDir, 'verified-shortlist.json'),
    scored: join(weeklyWorkingDir, 'scored.json'),
    pickerItems: join(weeklyWorkingDir, 'picker-items.json'),
  };

  const picker = generateShoppingPickerReport(shortlist, now);
  writeFileSync(weeklyPack.readme, generateWeeklyPackReadme(weekFolderName), 'utf-8');
  writeFileSync(weeklyPack.shoppingPicker, picker.markdown, 'utf-8');
  writeFileSync(weeklyPack.storeSummary, generateStoreSummaryReport(shortlist, now), 'utf-8');
  writeFileSync(weeklyPack.finalList, generateEmptyFinalListReport(now), 'utf-8');
  writeFileSync(weeklyPack.fullReport, fullReport, 'utf-8');
  writeFileSync(weeklyPack.audit, JSON.stringify(auditPayload, null, 2), 'utf-8');
  writeFileSync(weeklyPack.raw, JSON.stringify(items, null, 2), 'utf-8');
  writeFileSync(weeklyPack.verified, JSON.stringify(shortlist, null, 2), 'utf-8');
  writeFileSync(weeklyPack.scored, JSON.stringify(scoredPayload, null, 2), 'utf-8');
  writeFileSync(weeklyPack.pickerItems, JSON.stringify(picker.items, null, 2), 'utf-8');
  writeWebsiteExport(shortlist, now, weekFolderName);

  return {
    filepath,
    momFilepath,
    auditFilepath,
    verifiedMomFilepath,
    comparisonFilepath,
    rawFilepath,
    verifiedJsonFilepath,
    shoppingListFilepath: weeklyPack.shoppingPicker,
    storeSummaryFilepath: weeklyPack.storeSummary,
    weeklyPackDir,
    scored,
  };
}
