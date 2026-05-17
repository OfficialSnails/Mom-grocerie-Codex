// Promo words to strip from item names before matching
const PROMO_WORDS = [
  'club size', 'format club', 'family size', 'format familial',
  'selected varieties', 'variétés choisies', 'varietes choisies',
  'limite', 'limit', 'with card', 'avec carte',
  'ou moins', 'or less', 'max', 'par client', 'per customer',
  'bonus pack', 'emballage bonus', 'promo', 'spécial', 'special',
  'sans taxe', 'tax free',
];

// Remove accents/diacritics from a string
export function removeAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Normalize string for matching: lowercase, remove accents, trim, collapse spaces
export function normalizeString(s: string): string {
  return removeAccents(s.toLowerCase().trim()).replace(/\s+/g, ' ');
}

// Strip promo words and common qualifiers from item name
export function cleanItemName(raw: string): string {
  let cleaned = raw.toLowerCase();

  for (const word of PROMO_WORDS) {
    cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
  }

  // Remove size/weight tokens like "454g", "1kg", "2L", "900ml"
  cleaned = cleaned.replace(/\b\d+\s*(kg|g|lb|lbs|l|ml|litre|litres)\b/gi, '');

  // Remove pure number tokens like "12" (eggs count etc.) — preserve if only token
  cleaned = cleaned.replace(/\b\d+\b/g, ' ');

  return cleaned.replace(/\s+/g, ' ').trim();
}

export interface Product {
  id: string;
  normalized_name: string;
  display_name: string;
  category: string;
  synonyms: string[];
  unit_type: string;
  is_stock_up_friendly: boolean;
}

// Score how well a raw item name matches a product
function matchScore(rawNorm: string, product: Product): number {
  const prodNorm = normalizeString(product.normalized_name);

  // Exact match on normalized_name
  if (rawNorm === prodNorm) return 100;

  // Contains normalized_name
  if (rawNorm.includes(prodNorm)) return 85;
  if (prodNorm.includes(rawNorm) && rawNorm.length > 4) return 80;

  // Check synonyms
  for (const syn of product.synonyms) {
    const synNorm = normalizeString(syn);
    if (rawNorm === synNorm) return 95;
    if (rawNorm.includes(synNorm) && synNorm.length > 3) return 75;
    if (synNorm.includes(rawNorm) && rawNorm.length > 4) return 70;
  }

  // Word overlap: count shared words
  const rawWords = new Set(rawNorm.split(' ').filter(w => w.length > 2));
  const prodWords = new Set(prodNorm.split(' ').filter(w => w.length > 2));
  const shared = [...rawWords].filter(w => prodWords.has(w)).length;

  if (rawWords.size > 0 && shared / rawWords.size >= 0.5) {
    return 40 + Math.round((shared / rawWords.size) * 20);
  }

  return 0;
}

export function findMatchingProduct(rawName: string, products: Product[]): Product | null {
  const cleanedNorm = normalizeString(cleanItemName(rawName));
  const rawNorm = normalizeString(rawName);

  let bestScore = 0;
  let bestProduct: Product | null = null;

  for (const product of products) {
    // Try both cleaned and raw versions
    const s1 = matchScore(cleanedNorm, product);
    const s2 = matchScore(rawNorm, product);
    const score = Math.max(s1, s2);

    if (score > bestScore) {
      bestScore = score;
      bestProduct = product;
    }
  }

  // Require minimum match quality
  return bestScore >= 60 ? bestProduct : null;
}
