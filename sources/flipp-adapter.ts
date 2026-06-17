import type { RawDealItem, SourceAdapter } from './source-adapter.js';
import { shouldRunSource, updateSourceStatus } from './firecrawl-adapter.js';
import { addDays, format, parseISO } from 'date-fns';

const WISHABI_BASE = 'https://backflipp.wishabi.com/flipp';
const POSTAL_CODE = 'J6E3N2';
const LOCALE = 'fr-CA';

const HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://flipp.com/',
  'Origin': 'https://flipp.com',
};

// Match merchant names to our store_ids — order matters (most specific first).
// Joliette's postal code remains the Quebec flyer anchor, but store names are
// shopper-facing Quebec labels instead of local branch names.
const MERCHANT_PATTERNS: Array<{ pattern: RegExp; store_id: string; store_name: string; main_only?: boolean }> = [
  { pattern: /^costco$/i,                         store_id: 'costco-quebec',        store_name: 'Costco' },
  { pattern: /familiprix/i,                       store_id: 'familiprix-joliette',  store_name: 'Familiprix' },
  { pattern: /super[\s-]?c/i,                     store_id: 'superc-joliette',      store_name: 'Super C' },
  { pattern: /march[eé]\s+bonichoix|bonichoix/i,  store_id: 'bonichoix-joliette',   store_name: 'BoniChoix' },
  { pattern: /inter[\s-]?march[eé]/i,             store_id: 'intermarche-joliette', store_name: "L'Inter-Marché" },
  { pattern: /march[eé]s?\s+tradition/i,          store_id: 'tradition-joliette',   store_name: 'Marchés Tradition' },
  { pattern: /^iga$/i,                            store_id: 'iga-joliette',         store_name: 'IGA', main_only: false },
  { pattern: /^maxi$/i,                           store_id: 'maxi-joliette',        store_name: 'Maxi' },
  { pattern: /^metro$/i,                          store_id: 'metro-joliette',       store_name: 'Metro' },
];

interface WishabiFlyer {
  id: number;
  merchant: string;
  name: string;
  valid_from: string;
  valid_to: string;
  categories_csv?: string;
}

interface WishabiItem {
  id: number;
  flyer_id: number;
  name: string;
  brand: string | null;
  price: string;
  print_id?: string | null;
  pre_price_text?: string;   // sometimes holds original price
  discount: number | null;   // % off when explicitly shown (e.g. 33 = 33%)
  valid_from: string;
  valid_to: string;
  cutout_image_url?: string;
}

interface WishabiFlyersResponse {
  flyers: WishabiFlyer[];
}

interface WishabiItemsResponse {
  items: WishabiItem[];
}

interface FlyerCycle {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
}

const TORONTO_TIME_ZONE = 'America/Toronto';
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function parseFrenchName(raw: string): string {
  // Bilingual names: "croustilles tortilla Doritos | Doritos tortilla chips"
  // Take French part (before " | "), capitalize first letter
  const french = raw.split(' | ')[0].trim();
  return french.charAt(0).toUpperCase() + french.slice(1);
}

function parseItemPrice(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;

  // Multi-buy: "2/5.00" or "3/10.00"
  const multiMatch = cleaned.match(/^(\d+)\s*\/\s*(\d+(?:[.,]\d{1,2})?)$/);
  if (multiMatch) {
    const qty = parseInt(multiMatch[1]);
    const total = parseFloat(multiMatch[2].replace(',', '.'));
    if (qty > 0 && !isNaN(total)) return Math.round((total / qty) * 100) / 100;
  }

  const price = parseFloat(cleaned.replace(',', '.'));
  if (!isNaN(price) && price > 0 && price < 500) return price;
  return null;
}

function inferUnitFromPrintId(printId?: string | null): string | undefined {
  if (!printId) return undefined;
  const suffix = printId.split('_').pop()?.toUpperCase();

  // In Flipp/Wishabi grocery data, random-weight _KG items are displayed in
  // Canadian flyers as price per lb with the kg equivalent printed beside it.
  if (suffix === 'KG') return 'lb';
  if (suffix === 'EA') return 'each';
  return undefined;
}

function getTorontoDateParts(date: Date): { year: number; month: number; day: number; weekday: number } {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);

  const year = Number(formatted.find(part => part.type === 'year')?.value);
  const month = Number(formatted.find(part => part.type === 'month')?.value);
  const day = Number(formatted.find(part => part.type === 'day')?.value);
  const weekdayLabel = formatted.find(part => part.type === 'weekday')?.value ?? 'Sun';
  const weekday = WEEKDAY_INDEX[weekdayLabel] ?? 0;

  return { year, month, day, weekday };
}

function formatUtcDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function flyerDateOnly(value: string): string {
  return value.slice(0, 10);
}

function dateOnlyOverlaps(start: string, end: string, candidateStart: string, candidateEnd: string): boolean {
  return (
    (start >= candidateStart && start <= candidateEnd) ||
    (end >= candidateStart && end <= candidateEnd) ||
    (candidateStart >= start && candidateStart <= end)
  );
}

export function matchMerchant(merchant: string): { store_id: string; store_name: string } | null {
  for (const { pattern, store_id, store_name } of MERCHANT_PATTERNS) {
    if (pattern.test(merchant.trim())) return { store_id, store_name };
  }
  return null;
}

function getTargetFlyerCycle(now: Date = new Date()): FlyerCycle {
  const { year, month, day, weekday } = getTorontoDateParts(now);
  const anchor = new Date(Date.UTC(year, month - 1, day));
  const offsetToStart = weekday === 3 ? 1 : -((weekday - 4 + 7) % 7);
  const start = addDays(anchor, offsetToStart);
  const end = addDays(start, 6);

  return {
    start,
    end,
    startDate: formatUtcDateOnly(start),
    endDate: formatUtcDateOnly(end),
  };
}

function overlapsTargetCycle(flyer: WishabiFlyer, cycle: FlyerCycle): boolean {
  return dateOnlyOverlaps(
    cycle.startDate,
    cycle.endDate,
    flyerDateOnly(flyer.valid_from),
    flyerDateOnly(flyer.valid_to),
  );
}

function scoreFlyer(flyer: WishabiFlyer, cycle: FlyerCycle): number {
  const name = flyer.name.toLowerCase();
  const validFrom = flyerDateOnly(flyer.valid_from);
  const validTo = flyerDateOnly(flyer.valid_to);
  let score = 0;

  if (validFrom === cycle.startDate && validTo === cycle.endDate) {
    score += 40;
  } else if (overlapsTargetCycle(flyer, cycle)) {
    score += 20;
  }

  if (/(weekly flyer|circulaire hebdomadaire|circulaire de la semaine|circulaire)/i.test(flyer.name)) {
    score += 20;
  }

  if (/(qu[eé]bec|\bqc\b)/i.test(flyer.name)) {
    score += 10;
  }

  if (/(brochure|barbecue|bbq|nouveau-brunswick|new brunswick|ontario)/i.test(name)) {
    score -= 25;
  }

  return score;
}

export function selectPrimaryFlyersForCycle(
  flyers: WishabiFlyer[],
  now: Date = new Date(),
): WishabiFlyer[] {
  const cycle = getTargetFlyerCycle(now);
  const candidates = flyers.filter(flyer => overlapsTargetCycle(flyer, cycle));
  const grouped = new Map<string, WishabiFlyer[]>();

  for (const flyer of candidates) {
    const match = matchMerchant(flyer.merchant);
    if (!match) continue;
    if (!grouped.has(match.store_id)) grouped.set(match.store_id, []);
    grouped.get(match.store_id)!.push(flyer);
  }

  const selected: WishabiFlyer[] = [];

  for (const storeFlyers of grouped.values()) {
    const best = [...storeFlyers].sort((a, b) => scoreFlyer(b, cycle) - scoreFlyer(a, cycle))[0];
    if (best) selected.push(best);
  }

  return selected;
}

export function wishabiItemOverlapsDate(
  item: Pick<WishabiItem, 'valid_from' | 'valid_to'>,
  date = new Date(),
): boolean {
  const startsAt = Date.parse(item.valid_from);
  const endsAt = Date.parse(item.valid_to);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) return true;
  const timestamp = date.getTime();
  return startsAt <= timestamp && timestamp <= endsAt;
}

export class FlippAdapter implements SourceAdapter {
  id = 'flipp-joliette';
  store_id = 'multi';
  enabled = true;

  private async fetchFlyers(): Promise<WishabiFlyer[]> {
    const res = await fetch(
      `${WISHABI_BASE}/flyers?locale=${LOCALE}&postal_code=${POSTAL_CODE}`,
      { headers: HEADERS }
    );
    if (!res.ok) throw new Error(`Flipp flyers API ${res.status}`);
    const data = await res.json() as WishabiFlyersResponse;
    return data.flyers ?? [];
  }

  private async fetchFlyerItems(flyerId: number): Promise<WishabiItem[]> {
    const res = await fetch(
      `${WISHABI_BASE}/flyers/${flyerId}?locale=${LOCALE}&include=page_items`,
      { headers: HEADERS }
    );
    if (!res.ok) throw new Error(`Flipp items API ${res.status} for flyer ${flyerId}`);
    const data = await res.json() as WishabiItemsResponse;
    return data.items ?? [];
  }

  async collect(): Promise<RawDealItem[]> {
    if (!this.enabled) return [];

    const check = shouldRunSource(this.id);
    if (!check.allowed) {
      console.log(`[${this.id}] Source ignorée: ${check.reason}`);
      return [];
    }

    try {
      console.log(`[${this.id}] Découverte des circulaires Joliette via Flipp API (${POSTAL_CODE})...`);
      const allFlyers = await this.fetchFlyers();
      const selectedFlyers = selectPrimaryFlyersForCycle(allFlyers);
      const cycle = getTargetFlyerCycle();
      console.log(
        `[${this.id}] Cycle ciblé: ${format(cycle.start, 'yyyy-MM-dd')} -> ${format(cycle.end, 'yyyy-MM-dd')}`
      );

      // Group matched flyers by store_id
      const storeFlyers = new Map<string, { flyers: WishabiFlyer[]; store_name: string }>();
      for (const flyer of selectedFlyers) {
        const match = matchMerchant(flyer.merchant);
        if (!match) continue;
        if (!storeFlyers.has(match.store_id)) {
          storeFlyers.set(match.store_id, { flyers: [], store_name: match.store_name });
        }
        storeFlyers.get(match.store_id)!.flyers.push(flyer);
      }

      const storeList = [...storeFlyers.entries()].map(([id, { flyers }]) =>
        `${id}(${flyers.length})`
      ).join(', ');
      console.log(`[${this.id}] Magasins trouvés: ${storeList}`);
      for (const [store_id, { flyers }] of storeFlyers) {
        for (const flyer of flyers) {
          console.log(
            `[${this.id}] Flyer retenu ${store_id}: ${flyer.name} (${flyer.valid_from.slice(0, 10)} -> ${flyer.valid_to.slice(0, 10)})`
          );
        }
      }

      const allItems: RawDealItem[] = [];

      for (const [store_id, { flyers, store_name }] of storeFlyers) {
        for (const flyer of flyers) {
          console.log(`[${this.id}] Collecte ${store_id} — ${flyer.name} (id: ${flyer.id})`);
          try {
            const rawItems = await this.fetchFlyerItems(flyer.id);
            let count = 0;

            for (const item of rawItems) {
              if (!wishabiItemOverlapsDate(item)) continue;

              const name = parseFrenchName(item.name);
              if (!name) continue;

              const price = parseItemPrice(item.price);
              if (!price) continue;

              // Skip corrupt Flipp entries (price too low or implausible discount)
              if (price < 0.25) continue;
              if (item.discount !== null && (item.discount > 90 || item.discount < 0)) continue;

              const hasDiscountBadge = item.discount !== null && item.discount > 0;
              allItems.push({
                store_id,
                store_name,
                item_name: name,
                brand: item.brand || undefined,
                current_price: price,
                unit: inferUnitFromPrintId(item.print_id),
                flipp_discount_pct: hasDiscountBadge ? item.discount! : undefined,
                source_url: `https://flipp.com/en-ca/joliette-qc/flyer/${flyer.id}`,
                source_image_url: item.cutout_image_url
                  ? item.cutout_image_url.replace(/^http:\/\//, 'https://')
                  : undefined,
                source_system: 'flipp',
                source_type: 'flyer',
                source_flyer_id: String(flyer.id),
                source_flyer_name: flyer.name,
                source_item_id: String(item.id),
                source_raw_name: item.name,
                source_raw_price: item.price,
                sale_start: item.valid_from,
                sale_end: item.valid_to,
                confidence: 'HIGH',
              });
              count++;
            }
            console.log(`[${this.id}] ${store_id}: ${count}/${rawItems.length} articles avec prix`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[${this.id}] Erreur items pour ${store_id} flyer ${flyer.id}: ${msg}`);
          }
        }
      }

      updateSourceStatus(this.id, true);
      console.log(`[${this.id}] Total: ${allItems.length} articles collectés`);
      return allItems;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${this.id}] Erreur Flipp API: ${msg}`);
      updateSourceStatus(this.id, false, msg);
      return [];
    }
  }
}
