import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { ScoredDeal } from './generate-report.js';
import { formatPriceFR } from './normalize-price.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_CACHE_PATH = join(__dirname, '..', 'data', 'last-week-scored.json');
const SCORED_DIR = join(__dirname, '..', 'reports', 'scored');

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

const KEYWORD_ALIASES: Record<string, string[]> = {
  poulet: ['poulet', 'chicken', 'poitrine de poulet', 'pilon', 'cuisse', 'volaille', 'coq'],
  boeuf: ['boeuf', 'bœuf', 'beef', 'bifteck', 'steak', 'haché', 'hache', 'rôti', 'roti', 'surlonge'],
  porc: ['porc', 'pork', 'côtelette', 'cotelettes', 'longe', 'jambon', 'bacon', 'saucisse', 'saucisson'],
  poisson: ['poisson', 'fish', 'saumon', 'sole', 'tilapia', 'morue', 'aiglefin', 'thon'],
  fruits: ['fruit', 'fraise', 'fraises', 'bleuet', 'bleuets', 'framboise', 'pomme', 'poire', 'banane', 'raisin', 'melon'],
  legumes: ['legume', 'légume', 'carotte', 'brocoli', 'concombre', 'tomate', 'laitue', 'poivron', 'oignon', 'ail', 'céleri', 'epinard', 'épinard', 'maïs', 'rutabaga'],
  fromage: ['fromage', 'cheese', 'cheddar', 'mozzarella', 'brie', 'gouda', 'parmesan'],
  beurre: ['beurre', 'butter', 'margarine'],
  pain: ['pain', 'bread', 'bagel', 'muffin anglais', 'hot dog', 'hamburger', 'kaiser'],
  pates: ['pates', 'pâtes', 'pasta', 'spaghetti', 'penne', 'rigatoni', 'macaroni', 'lasagne'],
  yogourt: ['yogourt', 'yogurt', 'yoplait', 'iogo', 'iögo', 'oikos'],
  lait: ['lait', 'milk', 'crème', 'creme', 'cream'],
  oeufs: ['oeuf', 'oeufs', 'œuf', 'œufs', 'egg', 'eggs'],
  fruits_mer: ['crevette', 'homard', 'pétoncle', 'petoncle', 'moule', 'palourde', 'surimi', 'crabe', 'pieuvre', 'calmar'],
};

interface ScoredSnapshot {
  generated_at?: string;
  report_variant?: string;
  week_label?: string;
  deals: ScoredDeal[];
}

const NON_FOOD_KEYWORDS = [
  'dentifrice', 'brosse a dents', 'chat', 'chien', 'litiere', 'savon',
  'detergent', 'nettoyant', 'desinfectant', 'couche', 'papier toilette',
  'papier hygienique', 'essuie tout', 'soins pour bebes', 'sudocrem', 'penaten', 'zincofax',
  'assouplisseur', 'fleecy', 'adoucissant', 'fabric softener',
  'plante', 'annuelle', 'yucca', 'balconniere', 'mosquito', 'dahlia', 'canna',
];

function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeToken(token: string): string {
  if (token.length <= 4) return token;
  if (token.endsWith('es')) return token.slice(0, -2);
  if (token.endsWith('s')) return token.slice(0, -1);
  return token;
}

function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(' ')
    .filter(Boolean)
    .map(normalizeToken);
}

function getLatestScoredPath(): string | null {
  if (existsSync(DATA_CACHE_PATH)) return DATA_CACHE_PATH;
  if (!existsSync(SCORED_DIR)) return null;

  const candidates = readdirSync(SCORED_DIR)
    .filter(name => name.endsWith('-scored.json'))
    .sort()
    .reverse();

  if (candidates.length === 0) return null;
  return join(SCORED_DIR, candidates[0]);
}

export function loadScoredCache(): ScoredSnapshot | null {
  const path = getLatestScoredPath();
  if (!path || !existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as ScoredSnapshot | ScoredDeal[];
    if (Array.isArray(parsed)) {
      return { deals: parsed };
    }
    return parsed;
  } catch {
    return null;
  }
}

function expandKeyword(keyword: string): string[] {
  const lower = normalizeText(keyword);
  for (const [key, aliases] of Object.entries(KEYWORD_ALIASES)) {
    const normalizedKey = normalizeText(key);
    const normalizedAliases = aliases.map(normalizeText);
    if (normalizedKey === lower) {
      return [normalizedKey, ...normalizedAliases];
    }
    if (normalizedAliases.includes(lower)) {
      return [lower];
    }
  }
  return [lower];
}

function fuzzyIncludes(haystack: string, needle: string): boolean {
  if (!needle) return false;
  if (haystack.includes(needle)) return true;
  if (needle.length < 6) return false;
  const words = haystack.split(' ').map(normalizeToken);
  const target = normalizeToken(needle);
  return words.some(word => word.length >= 6 && word.startsWith(target));
}

function itemMatchesKeyword(deal: ScoredDeal, terms: string[]): boolean {
  const rawFields = [
    deal.item_name,
    deal.normalized_name ?? '',
    deal.category ?? '',
    deal.brand ?? '',
    deal.source_raw_name ?? '',
  ];
  const fields = rawFields.map(normalizeText);
  const fieldTokens = rawFields.flatMap(tokenize);

  return terms.some(term => {
    const normalizedTerm = normalizeText(term);
    const termTokens = tokenize(term);
    if (!normalizedTerm) return false;

    if (fields.some(field => field.includes(normalizedTerm))) return true;
    if (termTokens.length === 1) {
      return fieldTokens.includes(termTokens[0]) || fields.some(field => fuzzyIncludes(field, normalizedTerm));
    }

    return false;
  });
}

function dealEmoji(label: string): string {
  if (['MUST_BUY', 'STOCK_UP'].includes(label)) return '✅';
  if (label === 'GREAT_DEAL') return '🟢';
  if (label === 'NOT_ENOUGH_HISTORY') return '❓';
  return '🔵';
}

function priceDisplay(deal: ScoredDeal): string {
  const p = formatPriceFR(deal.current_price);
  const unit = deal.unit === 'kg' ? '/kg' : deal.unit === 'lb' ? '/lb' : deal.unit === 'L' ? '/L' : '';
  return `${p}${unit}`;
}

function storeRank(deal: ScoredDeal): number {
  return deal.normalized_price_per_unit ?? deal.current_price;
}

function isBundleLikeOffer(deal: ScoredDeal): boolean {
  const name = normalizeText(deal.item_name);
  const orCount = (name.match(/\bou\b/g) ?? []).length;
  const commaCount = (deal.item_name.match(/,/g) ?? []).length;
  return deal.item_name.length >= 95 || orCount >= 2 || commaCount >= 3;
}

function isShopperSafeQueryDeal(deal: ScoredDeal): boolean {
  if (deal.source_system === 'mock') return false;
  if (!['flipp', 'csv', 'firecrawl'].includes(deal.source_system ?? '')) return false;
  if (deal.source_system !== 'csv' && !deal.source_url) return false;
  if (isBundleLikeOffer(deal)) return false;

  const text = normalizeText([
    deal.item_name,
    deal.normalized_name ?? '',
    deal.category ?? '',
    deal.source_raw_name ?? '',
  ].join(' '));

  return !NON_FOOD_KEYWORDS.some(term => text.includes(term));
}

function shopperRank(deal: ScoredDeal): number {
  const base = storeRank(deal);
  if (deal.worth_buying) return base - 1000;
  if (deal.label === 'GREAT_DEAL') return base - 500;
  if (deal.label === 'GOOD_IF_NEEDED') return base - 200;
  if (deal.label === 'NOT_ENOUGH_HISTORY') return base + 50;
  return base + 100;
}

export function queryDeals(keywords: string[]): string {
  const snapshot = loadScoredCache();
  if (!snapshot || snapshot.deals.length === 0) {
    return '❌ Aucune donnée cette semaine — lance `npm run weekly` d’abord.';
  }

  const deals = snapshot.deals.filter(isShopperSafeQueryDeal);
  const lines: string[] = [];
  lines.push(`# 🔍 Recherche spéciaux — ${keywords.join(', ')}`);
  lines.push(`${format(new Date(snapshot.generated_at ?? Date.now()), 'd MMMM yyyy', { locale: fr })} · Joliette et région`);
  lines.push(`Prix en CAD · source snapshot: ${snapshot.report_variant ?? 'inconnue'}`);
  lines.push('');

  let totalSections = 0;

  for (const keyword of keywords) {
    const terms = expandKeyword(keyword);
    const matches = deals.filter(d => itemMatchesKeyword(d, terms));
    const byItem = new Map<string, ScoredDeal[]>();

    for (const deal of matches) {
      const key = normalizeText(deal.normalized_name ?? deal.item_name);
      if (!byItem.has(key)) byItem.set(key, []);
      byItem.get(key)!.push(deal);
    }

    const bestByItem = [...byItem.values()]
      .map(group => [...group].sort((a, b) => shopperRank(a) - shopperRank(b))[0])
      .sort((a, b) => shopperRank(a) - shopperRank(b))
      .slice(0, 15);

    lines.push(`## ${keyword.charAt(0).toUpperCase() + keyword.slice(1)}`);
    lines.push('');

    if (bestByItem.length === 0) {
      lines.push('*Aucun article trouvé cette semaine.*');
      lines.push('');
      continue;
    }

    totalSections++;

    bestByItem.forEach((best, index) => {
      const key = normalizeText(best.normalized_name ?? best.item_name);
      const allStores = [...(byItem.get(key) ?? [])].sort((a, b) => storeRank(a) - storeRank(b));
      const emoji = dealEmoji(best.label);
      const saving = best.flipp_discount_pct
        ? ` · ${best.flipp_discount_pct}% de rabais`
        : '';

      lines.push(`**${index + 1}.** ${emoji} **${best.item_name}** — ${priceDisplay(best)}${saving}`);
      lines.push(`> 🏪 Meilleur prix: **${STORE_SHORT[best.store_id] ?? best.store_id}**`);

      const alternatives = allStores.slice(1, 4).map(d =>
        `${STORE_SHORT[d.store_id] ?? d.store_id} ${priceDisplay(d)}`
      );
      if (alternatives.length > 0) {
        lines.push(`> *Autres magasins: ${alternatives.join(' · ')}*`);
      }

      if (best.label !== 'NOT_ENOUGH_HISTORY') {
        lines.push(`> *${best.french_reason}*`);
      } else {
        lines.push('> *Premier aperçu*');
      }

      if (best.source_url) {
        lines.push(`> [Voir la source](${best.source_url})`);
      }

      lines.push('');
    });
  }

  if (totalSections === 0) {
    lines.push('*Aucun résultat utile pour ces mots-clés.*');
  }

  lines.push('---');
  lines.push('*Résultats calculés depuis le dernier snapshot scoré sauvegardé.*');

  return lines.join('\n');
}

if (process.argv[1]?.endsWith('query-deals.ts') || process.argv[1]?.endsWith('query-deals.js')) {
  const keywords = process.argv.slice(2);
  console.log(queryDeals(keywords));
}
