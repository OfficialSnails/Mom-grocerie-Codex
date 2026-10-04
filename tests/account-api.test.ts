import { describe, expect, it, vi } from 'vitest';
import { accountResponse } from '../src/account-api.js';
import { parseProfile } from '../src/account-data.js';

const env = { CLERK_PUBLISHABLE_KEY: 'pk_test_unit', CLERK_SECRET_KEY: 'private-key', DATABASE_URL: 'private-database' };
function dependencies() {
  return { authenticate: vi.fn(async () => 'owner-a'), repository: {
    profile: vi.fn(async () => ({})), saveProfile: vi.fn(async (_owner, data) => data),
    lists: vi.fn(async () => []), saveList: vi.fn(async () => true), removeList: vi.fn(async () => {}), clear: vi.fn(async () => {}),
  } };
}
function request(path: string, method = 'GET', data?: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost:4187/api/account${path}`, { method,
    headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json', ...headers },
    body: data === undefined ? undefined : JSON.stringify(data) });
}
describe('private account API', () => {
  it('returns only public configuration and locks development keys on public hosts', async () => {
    const local = await accountResponse(request('/config'), env);
    const config = await local.json();
    expect(config).toMatchObject({ enabled: true, publishableKey: 'pk_test_unit' });
    expect(Object.keys(config).sort()).toEqual(['enabled', 'localization', 'publishableKey']);
    const hosted = await accountResponse(new Request('https://example.com/api/account/config'), env);
    expect(await hosted.json()).toEqual({ enabled: false, publishableKey: null });
  });
  it('rejects absent or invalid auth before database access', async () => {
    const dep = dependencies();
    const response = await accountResponse(request('/lists', 'GET', undefined, { Authorization: '' }), env, dep);
    expect(response.status).toBe(401); expect(dep.repository.lists).not.toHaveBeenCalled();
    dep.authenticate.mockRejectedValueOnce(new Error('invalid signature'));
    expect((await accountResponse(request('/lists'), env, dep)).status).toBe(401);
    expect(dep.repository.lists).not.toHaveBeenCalled();
  });
  it('rejects foreign origins and does not trust a supplied owner', async () => {
    const dep = dependencies();
    expect((await accountResponse(request('/profile', 'PUT', { ownerId: 'owner-b' }, { Origin: 'https://other.example' }), env, dep)).status).toBe(403);
    expect(dep.repository.saveProfile).not.toHaveBeenCalled();
    expect((await accountResponse(request('/profile', 'PUT', { name: 'Alice', ownerId: 'owner-b' }), env, dep)).status).toBe(200);
    expect(dep.repository.saveProfile).toHaveBeenCalledWith('owner-a', expect.not.objectContaining({ ownerId: 'owner-b' }));
    await accountResponse(request('/lists/joliette:week-1', 'DELETE'), env, dep);
    expect(dep.repository.removeList).toHaveBeenCalledWith('owner-a', 'joliette:week-1');
    await accountResponse(request('/data', 'DELETE'), env, dep);
    expect(dep.repository.clear).toHaveBeenCalledWith('owner-a');
  });
  it('does not leak provider errors or accept corrupt lists and oversized content', async () => {
    const dep = dependencies();
    dep.repository.lists.mockRejectedValueOnce(new Error('postgres://user:private-secret@host'));
    const response = await accountResponse(request('/lists'), env, dep);
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('private-secret');
    expect((await accountResponse(request('/lists', 'PUT', { snapshot: {} }), env, dep)).status).toBe(400);
    expect((await accountResponse(request('/profile', 'PUT', { name: 'x'.repeat(500_001) }), env, dep)).status).toBe(413);
    expect(dep.repository.saveList).not.toHaveBeenCalled(); expect(dep.repository.saveProfile).not.toHaveBeenCalled();
  });
  it('validates Quebec addresses without inventing coordinates or service coverage', () => {
    expect(parseProfile({ postalCode: 'h2x 1y4', street: '  Example  ', mode: 'delivery' })).toMatchObject({ postalCode: 'H2X1Y4', street: 'Example', mode: 'delivery' });
    expect(() => parseProfile({ postalCode: '123456' })).toThrow();
    expect(() => parseProfile({ mode: 'confirmed-delivery' })).toThrow();
    expect(parseProfile({ lat: 45, lon: -73 })).not.toHaveProperty('lat');
    expect(parseProfile({ favorites: { metro: 'metro-branch-12' } }).favorites).toEqual({ metro: 'metro-branch-12' });
    expect(() => parseProfile({ favorites: ['metro'] })).toThrow();
    expect(() => parseProfile({ favorites: { metro: 'https://untrusted.example' } })).toThrow();
  });
});
