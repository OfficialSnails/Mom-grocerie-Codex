import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const files = vi.hoisted(() => new Map<string, string>());
vi.mock('node:fs', () => ({ readFileSync: (path: string) => {
  const file = [...files.keys()].find(key => path.endsWith('/' + key));
  if (!file) throw new Error(`Missing fixture: ${path}`);
  return files.get(file);
} }));
vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn() }));
import { verifyPublishedData } from '../src/verify-published-data.js';

beforeEach(() => {
  files.clear();
  const index = JSON.stringify({ weeks: [{ slug: 'new-week', folderName: 'New week', path: 'data/weeks/new-week/week.json' }] });
  files.set('data/weeks/index.json', index);
  files.set('data/regions.json', JSON.stringify({ regions: [{ id: 'joliette', indexPath: 'data/weeks/index.json' }] }));
  for (const file of ['data/price-history.json', 'data/weeks/new-week/week.json', 'data/weeks/new-week/flyers.json', 'data/weeks/new-week/offer-evidence.json']) files.set(file, '{}');
  vi.stubGlobal('fetch', vi.fn(async (url: URL) => new Response(files.get(url.pathname.slice(1)))));
});
afterEach(() => { vi.unstubAllGlobals(); });

it('verifies current weeks, proof data and price history against the exact release', async () => {
  await verifyPublishedData();
  expect(fetch).toHaveBeenCalledTimes(6);
});
it('rejects stale published bytes after bounded retries', async () => {
  vi.mocked(fetch).mockImplementation(async () => new Response('old data'));
  await expect(verifyPublishedData()).rejects.toThrow('does not match');
  expect(fetch).toHaveBeenCalledTimes(3);
});
it('rejects a stale regional week before fetching production', async () => {
  files.set('data/regions.json', JSON.stringify({ regions: [{ id: 'montreal', indexPath: 'data/regions/montreal/index.json' }] }));
  files.set('data/regions/montreal/index.json', JSON.stringify({ weeks: [{ slug: 'old-week' }] }));
  await expect(verifyPublishedData()).rejects.toThrow('Stale regional week');
  expect(fetch).not.toHaveBeenCalled();
});

it('accepts data after a transient HTTP failure', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response('Unavailable', { status: 503 }));
  await verifyPublishedData();
  expect(fetch).toHaveBeenCalledTimes(7);
});
it('rejects missing local release data instead of skipping it', async () => {
  files.delete('data/price-history.json');
  await expect(verifyPublishedData()).rejects.toThrow('Missing fixture');
});
