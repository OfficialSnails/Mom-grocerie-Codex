import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { lbToKg, normalizePrice } from './normalize-price.js';
import type { ScoredDeal } from './generate-report.js';
import { normalizeString } from './normalize-product.js';
import type { RawDealItem } from '../sources/source-adapter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', '.cache', 'proof-ocr');

function commandExists(command: string): boolean {
  try {
    execFileSync('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function cacheKey(url: string): string {
  return createHash('sha1').update(url).digest('hex');
}

export function normalizeOcrText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ＳS]\s*\/\s*/gi, '$/')
    .replace(/%\s*kg/gi, '$/kg')
    .replace(/S\s*\/\s*(lb|1b|ib|kg|100g)/gi, '$/$1')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function extractNumbers(text: string): number[] {
  return [...text.matchAll(/\d{1,3}(?:[,.]\d{1,2})?/g)]
    .map(match => Number(match[0].replace(',', '.')))
    .filter(value => Number.isFinite(value) && value > 0 && value < 500);
}

function hasNumberCloseTo(numbers: number[], target: number, tolerance = 0.08): boolean {
  return numbers.some(value => Math.abs(value - target) <= Math.max(tolerance, target * 0.015));
}

export function inferUnitFromProofText(currentPrice: number, ocrText: string): '100g' | 'lb' | 'kg' | null {
  const text = normalizeOcrText(ocrText);
  const numbers = extractNumbers(text);

  if (/(?:\$\/100\s*g|\/100\s*g|\$\/100g|\/100g)/i.test(text)) return '100g';

  const kgEquivalentFromLb = lbToKg(currentPrice);
  if (/(?:\$\/kg|\/kg)/i.test(text) && hasNumberCloseTo(numbers, kgEquivalentFromLb, 0.12)) {
    return 'lb';
  }

  if (/(?:\$\/lb|\/lb|\$\/1b|\/1b|\$\/ib|\/ib)/i.test(text)) return 'lb';

  if (/(?:\$\/kg|\/kg)/i.test(text) && hasNumberCloseTo(numbers, currentPrice, 0.08)) {
    return 'kg';
  }

  return null;
}

export function inferPackageSizeFromProofText(ocrText: string): { size: string; unit: 'g'; label: string } | null {
  const text = normalizeOcrText(ocrText);
  if (/\b1\s*(?:lb|1b|ib)\b/i.test(text)) {
    return { size: '454', unit: 'g', label: 'paquet de 1 lb' };
  }
  return null;
}

export function ocrProofImage(url: string): string | null {
  if (!commandExists('tesseract') || !commandExists('curl')) return null;
  mkdirSync(CACHE_DIR, { recursive: true });

  const key = cacheKey(url);
  const textPath = join(CACHE_DIR, `${key}.txt`);
  if (existsSync(textPath)) return readFileSync(textPath, 'utf-8');

  const imagePath = join(CACHE_DIR, `${key}.jpg`);
  try {
    if (!existsSync(imagePath)) {
      execFileSync('curl', ['-fsSL', url, '-o', imagePath], { stdio: 'ignore' });
      if (commandExists('sips')) {
        execFileSync('sips', ['-Z', '1600', imagePath], { stdio: 'ignore' });
      }
    }

    const psm11 = execFileSync('tesseract', [imagePath, 'stdout', '-l', 'eng+fra', '--psm', '11'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 15_000,
    });
    const psm6 = execFileSync('tesseract', [imagePath, 'stdout', '-l', 'eng+fra', '--psm', '6'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 15_000,
    });
    const text = `${psm11}\n${psm6}`;
    writeFileSync(textPath, text, 'utf-8');
    return text;
  } catch {
    writeFileSync(textPath, '', 'utf-8');
    return null;
  }
}

export interface OcrRecoveredOffer {
  item_name: string;
  brand?: string;
  current_price: number;
  unit?: string;
  size?: string;
  source_raw_name: string;
  source_raw_price: string;
  notes: string;
}

function titleContainsStMethodeBread(text: string): boolean {
  const normalized = normalizeOcrText(text);
  return (
    /(pain|pains)\s+tranche/.test(normalized) &&
    /(st\s*methode|st-?methode|methode|recolte\s+st|grand[-\s]?pere)/.test(normalized)
  );
}

function extractLooseMoneyAmount(context: string): number | null {
  const normalized = normalizeOcrText(context)
    .replace(/[$s]\s*(\d)/gi, '$1')
    .replace(/(\d)\s*[$s]/gi, '$1');

  const decimal = normalized.match(/\b(\d{1,2})[,.]\s*(\d{2})\b/);
  if (decimal) {
    const value = Number(`${decimal[1]}.${decimal[2]}`);
    return Number.isFinite(value) && value > 0 && value < 100 ? value : null;
  }

  const loose = normalized.match(/\b(\d{1,2})\s+(\d{2})\b/);
  if (loose) {
    const value = Number(`${loose[1]}.${loose[2]}`);
    return Number.isFinite(value) && value > 0 && value < 100 ? value : null;
  }

  const compact = normalized.match(/\b(\d)(\d{2})\b/);
  if (compact) {
    const value = Number(`${compact[1]}.${compact[2]}`);
    return Number.isFinite(value) && value > 0 && value < 100 ? value : null;
  }

  return null;
}

function extractPackageSizeLabel(text: string): string | null {
  const normalized = normalizeOcrText(text);
  const range = normalized.match(/\b(\d{3,4})\s*[-–]\s*(\d{3,4})\s*g\b/);
  if (range) return `${range[1]}-${range[2]} g`;
  const grams = normalized.match(/\b(\d{3,4})\s*g\b/);
  if (grams) return `${grams[1]} g`;
  return null;
}

export function extractRecoveredOffersFromProofText(ocrText: string): OcrRecoveredOffer[] {
  const normalized = normalizeOcrText(ocrText);
  const offers: OcrRecoveredOffer[] = [];

  if (titleContainsStMethodeBread(ocrText) && /rabais|reduction|réduction/.test(normalized)) {
    const amount = extractLooseMoneyAmount(normalized);
    if (amount !== null) {
      const packageSize = extractPackageSizeLabel(normalized);
      const rawName = [
        'PAIN TRANCHÉ ST-MÉTHODE',
        packageSize,
        /achat\s+de\s+2/.test(normalized) ? "rabais à l'achat de 2 pains" : 'rabais en circulaire',
      ].filter(Boolean).join(' — ');
      offers.push({
        item_name: packageSize ? `PAIN TRANCHÉ ST-MÉTHODE ${packageSize}` : 'PAIN TRANCHÉ ST-MÉTHODE',
        brand: 'St-Méthode',
        current_price: amount,
        source_raw_name: rawName,
        source_raw_price: `${amount.toFixed(2).replace('.', ',')} $ de rabais`,
        notes: `Offre récupérée par OCR de la preuve photo: ${rawName}`,
      });
    }
  }

  return offers;
}

function recoveredOfferKey(item: Pick<RawDealItem, 'store_id' | 'source_flyer_id' | 'source_image_url'>, offer: OcrRecoveredOffer): string {
  return [
    item.store_id,
    item.source_flyer_id ?? '',
    item.source_image_url ?? '',
    normalizeString(`${offer.item_name} ${offer.source_raw_price}`),
  ].join('::');
}

function hasEquivalentOffer(items: RawDealItem[], source: RawDealItem, offer: OcrRecoveredOffer): boolean {
  const targetName = normalizeString(`${offer.item_name} ${offer.source_raw_name}`);
  return items.some(item => {
    if (item.store_id !== source.store_id) return false;
    if ((item.source_flyer_id ?? '') !== (source.source_flyer_id ?? '')) return false;
    const itemText = normalizeString(`${item.item_name} ${item.source_raw_name ?? ''} ${item.notes ?? ''}`);
    if (itemText.includes('st methode') && itemText.includes('pain')) return true;
    return itemText.includes(targetName) || targetName.includes(itemText);
  });
}

export function recoverMissingOffersFromProofOcr(items: RawDealItem[]): RawDealItem[] {
  if (process.env.BONS_SPECIAUX_DISABLE_OCR_RECOVERY === '1') return items;

  const recovered: RawDealItem[] = [];
  const seenRecovered = new Set<string>();
  const seenImages = new Set<string>();

  for (const item of items) {
    if (!item.source_image_url || seenImages.has(item.source_image_url)) continue;
    seenImages.add(item.source_image_url);

    const ocrText = ocrProofImage(item.source_image_url);
    if (!ocrText) continue;

    for (const offer of extractRecoveredOffersFromProofText(ocrText)) {
      const key = recoveredOfferKey(item, offer);
      if (seenRecovered.has(key) || hasEquivalentOffer([...items, ...recovered], item, offer)) continue;
      seenRecovered.add(key);

      recovered.push({
        ...item,
        item_name: offer.item_name,
        brand: offer.brand ?? item.brand,
        current_price: offer.current_price,
        regular_price: undefined,
        size: offer.size,
        unit: offer.unit,
        source_item_id: `${item.source_item_id ?? item.source_image_url ?? 'image'}::ocr-recovered::${seenRecovered.size}`,
        source_raw_name: offer.source_raw_name,
        source_raw_price: offer.source_raw_price,
        notes: [item.notes, offer.notes].filter(Boolean).join(' | '),
        confidence: item.confidence === 'LOW' ? 'MEDIUM' : item.confidence,
        normalized_name: normalizeString(offer.item_name),
        category: item.category,
      });
    }
  }

  return recovered.length > 0 ? [...items, ...recovered] : items;
}

export function enrichDealsWithProofOcr<T extends ScoredDeal>(deals: T[]): T[] {
  return deals.map(deal => {
    if (!deal.source_image_url) return deal;

    const ocrText = ocrProofImage(deal.source_image_url);
    if (!ocrText) return deal;

    const packageSize = inferPackageSizeFromProofText(`${ocrText}\n${deal.source_raw_name ?? ''}\n${deal.item_name}`);
    if (packageSize && (!deal.unit || deal.unit === 'each')) {
      const normalized = normalizePrice(deal.current_price, packageSize.size, packageSize.unit);
      return {
        ...deal,
        unit: packageSize.unit,
        size: packageSize.size,
        normalized_price_per_unit: normalized.price_per_unit,
        normalized_unit: normalized.normalized_unit,
        confidence: deal.confidence === 'LOW' ? 'MEDIUM' : deal.confidence,
        notes: [deal.notes, `Format inféré par OCR de la preuve photo: ${packageSize.label}`].filter(Boolean).join(' | '),
      };
    }

    if (deal.unit) return deal;

    const unit = inferUnitFromProofText(deal.current_price, ocrText);
    if (!unit) return deal;

    const normalized = normalizePrice(deal.current_price, '1', unit);
    return {
      ...deal,
      unit,
      size: '1',
      normalized_price_per_unit: normalized.price_per_unit,
      normalized_unit: normalized.normalized_unit,
      confidence: deal.confidence === 'LOW' ? 'MEDIUM' : deal.confidence,
      notes: [deal.notes, `Format inféré par OCR de la preuve photo: ${unit}`].filter(Boolean).join(' | '),
    };
  });
}
