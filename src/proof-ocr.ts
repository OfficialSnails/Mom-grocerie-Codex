import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { lbToKg, normalizePrice } from './normalize-price.js';
import type { ScoredDeal } from './generate-report.js';

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

function normalizeOcrText(text: string): string {
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

function ocrProofImage(url: string): string | null {
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
