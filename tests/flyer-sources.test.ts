import { describe, expect, it } from 'vitest';
import { buildFlyerSources } from '../src/flyer-sources.js';
import type { RawDealItem } from '../sources/source-adapter.js';

describe('circular source metadata', () => {
  it('keeps source URLs and periods, groups store aliases and ignores non-flyer rows', () => {
    const item: RawDealItem = {
      store_id: 'bonichoix-stemilie', store_name: 'BoniChoix', item_name: 'Pommes',
      current_price: 2.99, confidence: 'HIGH', source_system: 'flipp', source_flyer_id: '123',
      source_url: 'https://flipp.com/en-ca/joliette-qc/flyer/123',
      source_image_url: 'https://example.com/proof.jpg',
      sale_start: '2026-10-01T00:00:00-04:00', sale_end: '2026-10-07T23:59:59-04:00',
    };
    const originals: RawDealItem[] = [item, { ...item, store_id: 'bonichoix-joliette' }, { ...item, source_system: 'csv', source_flyer_id: undefined }];
    const before = JSON.stringify(originals);
    const flyers = buildFlyerSources(originals);
    expect(flyers).toHaveLength(1);
    expect(flyers[0]).toMatchObject({ storeId: 'bonichoix-joliette', url: item.source_url, startsAt: item.sale_start, endsAt: item.sale_end, images: [item.source_image_url] });
    expect(JSON.stringify(originals)).toBe(before);
  });
});

import { flyerPageMetadata } from '../src/refresh-flyer-pages.js';
// @ts-expect-error Static browser modules intentionally have no TypeScript build.
import { pageTiles } from '../website/flyer-pages.js';
describe('in-site flyer pages', () => {
  it('uses actual flyer dates, orders pages and keeps full image geometry', () => {
    const metadata = flyerPageMetadata({ id: 1, path: 'flyers/abc-123/', height: 512, resolutions: [1], thumbnail_url: 'http://f.wishabi.net/cover.jpg', valid_from: '2026-10-01', valid_to: '2026-10-07' }, [
      { page: 2, left: 256, right: 512, top: 0, bottom: -512 },
      { page: 1, left: 0, right: 256, top: 0, bottom: -512 },
    ]);
    expect(metadata.cover).toMatch(/^https:/);
    expect(metadata.pages.map(page => page.page)).toEqual([1, 2]);
    expect(metadata.endsAt).toBe('2026-10-07');
    expect(pageTiles(metadata, metadata.pages[1])).toEqual([
      { url: 'https://f.wishabi.net/flyers/abc-123/0_1_1.jpg', left: 0, top: 0, width: 100, height: 50 },
      { url: 'https://f.wishabi.net/flyers/abc-123/0_1_0.jpg', left: 0, top: 50, width: 100, height: 50 },
    ]);
  });
});
