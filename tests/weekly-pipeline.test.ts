import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({
  collect: vi.fn(), report: vi.fn(), persist: vi.fn(), history: vi.fn(),
  flyers: vi.fn(), regions: vi.fn(), evidence: vi.fn(),
}));
vi.mock('../src/collect-current-deals.js', () => ({ collectCurrentDeals: calls.collect }));
vi.mock('../src/generate-report.js', () => ({ generateReport: calls.report }));
vi.mock('../src/update-history.js', () => ({ persistScoredDeals: calls.persist, updateHistory: calls.history }));
vi.mock('../src/refresh-flyer-pages.js', () => ({ refreshFlyerPages: calls.flyers }));
vi.mock('../src/refresh-regions.js', () => ({ refreshRegions: calls.regions }));
vi.mock('../src/build-offer-evidence.js', () => ({ buildOfferEvidence: calls.evidence }));
vi.mock('../src/obsidian-style.js', () => ({ installObsidianStyle: vi.fn() }));
vi.mock('fs', () => ({
  existsSync: () => true,
  readFileSync: () => JSON.stringify([{ id: 'store', name: 'Store', enabled: true, priority_order: 1 }]),
  mkdirSync: vi.fn(), cpSync: vi.fn(), rmSync: vi.fn(),
}));
vi.mock('child_process', () => ({ execFileSync: vi.fn(), spawn: () => ({ unref: vi.fn() }) }));
import { main } from '../src/run-weekly.js';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('BONS_SPECIAUX_RUN_DATE', '');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  calls.collect.mockResolvedValue({ items: [{}], usedMock: false, hasLiveFlyerData: true, skippedAdapters: [], sourceSummary: {} });
  calls.report.mockResolvedValue({ weeklyPackDir: '/reports/weeks/Week', scored: [{}] });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('scheduled publication', () => {
  it.each([
    { usedMock: true, hasLiveFlyerData: false, items: [{}] },
    { usedMock: false, hasLiveFlyerData: false, items: [{}] },
    { usedMock: false, hasLiveFlyerData: true, items: [] },
  ])('rejects missing live input before writing reports/history: %j', async input => {
    calls.collect.mockResolvedValue(input);
    await expect(main()).rejects.toThrow('requires fresh live flyer data');
    expect(calls.report).not.toHaveBeenCalled();
    expect(calls.persist).not.toHaveBeenCalled();
  });

  it('persists new prices and regional snapshots before building website evidence/history', async () => {
    const order: string[] = [];
    for (const key of ['report', 'persist', 'history', 'flyers', 'regions', 'evidence'] as const) {
      calls[key].mockImplementation(() => {
        order.push(key);
        if (key === 'report') return { weeklyPackDir: '/reports/weeks/Week', scored: [] };
      });
    }
    await main();
    expect(order).toEqual(['report', 'persist', 'history', 'flyers', 'regions', 'evidence']);
  });

  it.each(['persist', 'history', 'flyers', 'regions', 'evidence'] as const)('fails publication when %s fails', async key => {
    calls[key].mockImplementation(() => { throw new Error(`${key} failed`); });
    await expect(main()).rejects.toThrow(`${key} failed`);
    if (key !== 'evidence') expect(calls.evidence).not.toHaveBeenCalled();
  });
});
