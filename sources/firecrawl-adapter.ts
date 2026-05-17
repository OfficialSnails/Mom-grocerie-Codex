import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { differenceInDays } from 'date-fns';
import type { RawDealItem } from './source-adapter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATUS_PATH = join(__dirname, '..', 'data', 'source_status.json');

// Minimum days between Firecrawl runs (respect free-tier limits)
const MIN_DAYS_BETWEEN_RUNS = 6;

interface SourceStatus {
  source_id: string;
  store_id: string;
  enabled: boolean;
  collection_method: string;
  robots_status: string;
  terms_status: string;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  notes: string;
}

interface StatusFile {
  sources: SourceStatus[];
}

function loadStatus(): StatusFile {
  if (!existsSync(STATUS_PATH)) return { sources: [] };
  return JSON.parse(readFileSync(STATUS_PATH, 'utf-8')) as StatusFile;
}

function saveStatus(data: StatusFile): void {
  writeFileSync(STATUS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function getSourceStatus(sourceId: string): SourceStatus | undefined {
  const data = loadStatus();
  return data.sources.find(s => s.source_id === sourceId);
}

export function updateSourceStatus(sourceId: string, success: boolean, error?: string): void {
  const data = loadStatus();
  const idx = data.sources.findIndex(s => s.source_id === sourceId);
  const now = new Date().toISOString();

  if (idx === -1) return;

  data.sources[idx].last_checked_at = now;
  if (success) {
    data.sources[idx].last_success_at = now;
    data.sources[idx].last_error = null;
  } else {
    data.sources[idx].last_error = error ?? 'Erreur inconnue';
  }

  saveStatus(data);
}

export function shouldRunSource(sourceId: string): { allowed: boolean; reason: string } {
  const status = getSourceStatus(sourceId);
  const ignoreRateLimit = process.env.BONS_SPECIAUX_IGNORE_RATE_LIMIT === '1';

  if (!status) {
    return { allowed: false, reason: 'Source inconnue dans source_status.json' };
  }

  if (!status.enabled) {
    return { allowed: false, reason: 'Source désactivée dans source_status.json' };
  }

  if (status.robots_status === 'disallowed') {
    return { allowed: false, reason: 'robots.txt interdit la collecte pour cette source' };
  }

  if (status.terms_status === 'disallowed') {
    return { allowed: false, reason: "Conditions d'utilisation interdisent la collecte" };
  }

  // Rate limit only applies to Firecrawl-backed sources; direct public APIs are
  // cheap enough to refresh on the weekly flyer cycle.
  if (status.collection_method === 'firecrawl' && status.last_success_at) {
    const lastRun = new Date(status.last_success_at);
    const daysSince = differenceInDays(new Date(), lastRun);
    if (!ignoreRateLimit && daysSince < MIN_DAYS_BETWEEN_RUNS) {
      return {
        allowed: false,
        reason: `Déjà collecté il y a ${daysSince} jour(s) — attente de ${MIN_DAYS_BETWEEN_RUNS} jours entre les collectes`
      };
    }
  }

  return { allowed: true, reason: 'OK' };
}

// Price patterns for Quebec grocery flyers (French and English)
const PRICE_PATTERNS = [
  // "4,99 $" or "4.99 $"
  /(\d+[,.]?\d*)\s*\$/g,
  // "$4.99" or "$4,99"
  /\$\s*(\d+[,.]?\d*)/g,
  // "4,99$/kg" or "4.99 $/lb"
  /(\d+[,.]?\d*)\s*\$\s*\/\s*(kg|lb|g|L|ml|each)/gi,
  // "2 pour 5,00 $" or "3 for $10"
  /(\d+)\s+(?:pour|for)\s+(\d+[,.]?\d*)\s*\$/gi,
];

export interface ParsedPriceItem {
  raw_text: string;
  price: number;
  unit?: string;
  quantity?: number;
}

export function parsePricesFromMarkdown(markdown: string): ParsedPriceItem[] {
  const results: ParsedPriceItem[] = [];
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Multi-price pattern: "2 pour X$" or "3 for $X"
    const multiMatch = line.match(/(\d+)\s+(?:pour|for)\s+\$?(\d+[,.]?\d*)\s*\$?/i);
    if (multiMatch) {
      const qty = parseInt(multiMatch[1]);
      const total = parseFloat(multiMatch[2].replace(',', '.'));
      if (qty > 0 && !isNaN(total)) {
        results.push({
          raw_text: line,
          price: Math.round((total / qty) * 100) / 100,
          quantity: qty,
        });
        continue;
      }
    }

    // Standard price pattern
    const priceMatch = line.match(/\$?(\d+)[,.](\d{2})\s*\$?(?:\s*\/\s*(kg|lb|g|L|ml|chacun|each))?/i);
    if (priceMatch) {
      const price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
      if (!isNaN(price) && price > 0 && price < 200) {
        results.push({
          raw_text: line,
          price,
          unit: priceMatch[3]?.toLowerCase(),
        });
      }
    }
  }

  return results;
}

export abstract class FirecrawlBaseAdapter {
  abstract id: string;
  abstract store_id: string;
  abstract store_name: string;
  abstract flyer_url: string;
  enabled = false;

  protected async scrapeAsJSON<T = unknown>(url: string, prompt: string): Promise<T[] | null> {
    const check = shouldRunSource(this.id);
    if (!check.allowed) {
      console.log(`[${this.id}] Source ignorée: ${check.reason}`);
      return null;
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.warn(`[${this.id}] FIRECRAWL_API_KEY manquante — source ignorée`);
      updateSourceStatus(this.id, false, 'FIRECRAWL_API_KEY manquante');
      return null;
    }

    try {
      const { default: FirecrawlApp } = await import('@mendable/firecrawl-js');
      const app = new FirecrawlApp({ apiKey });

      console.log(`[${this.id}] Collecte Firecrawl JSON: ${url}`);
      const result = await app.scrapeUrl(url, {
        formats: ['json' as never],
        jsonOptions: { prompt },
        waitFor: 3000,
        actions: [
          { type: 'wait', milliseconds: 2000 },
          { type: 'scroll', direction: 'down', amount: 3000 },
          { type: 'wait', milliseconds: 1500 },
          { type: 'scroll', direction: 'down', amount: 3000 },
          { type: 'wait', milliseconds: 1500 },
          { type: 'scroll', direction: 'down', amount: 3000 },
          { type: 'wait', milliseconds: 1000 },
        ],
      } as never);

      if (!(result as { success: boolean }).success) {
        const errMsg = 'error' in (result as object) ? String((result as { error: unknown }).error) : 'Échec Firecrawl';
        throw new Error(errMsg);
      }

      updateSourceStatus(this.id, true);
      const data = (result as { json?: unknown }).json;
      if (!data) return null;
      return (Array.isArray(data) ? data : ((data as Record<string, unknown>).items ?? (data as Record<string, unknown>).deals ?? [])) as T[];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${this.id}] Erreur Firecrawl JSON: ${msg}`);
      updateSourceStatus(this.id, false, msg);
      return null;
    }
  }

  protected async scrapeUrl(url: string): Promise<string | null> {
    const check = shouldRunSource(this.id);
    if (!check.allowed) {
      console.log(`[${this.id}] Source ignorée: ${check.reason}`);
      return null;
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.warn(`[${this.id}] FIRECRAWL_API_KEY manquante — source ignorée`);
      updateSourceStatus(this.id, false, 'FIRECRAWL_API_KEY manquante');
      return null;
    }

    try {
      // Dynamic import to avoid errors when Firecrawl is not installed
      const { default: FirecrawlApp } = await import('@mendable/firecrawl-js');
      const app = new FirecrawlApp({ apiKey });

      console.log(`[${this.id}] Collecte Firecrawl: ${url}`);
      const result = await app.scrapeUrl(url, { formats: ['markdown'] });

      if (!result.success) {
        const errMsg = 'error' in result ? String(result.error) : 'Échec Firecrawl';
        throw new Error(errMsg);
      }

      updateSourceStatus(this.id, true);
      return result.markdown ?? null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${this.id}] Erreur Firecrawl: ${msg}`);
      updateSourceStatus(this.id, false, msg);
      return null;
    }
  }

  parseFlyer(_markdown: string): RawDealItem[] {
    return [];
  }

  async collect(): Promise<RawDealItem[]> {
    if (!this.enabled) {
      console.log(`[${this.id}] Adaptateur désactivé — ignoré`);
      return [];
    }

    const markdown = await this.scrapeUrl(this.flyer_url);
    if (!markdown) return [];

    return this.parseFlyer(markdown);
  }
}
