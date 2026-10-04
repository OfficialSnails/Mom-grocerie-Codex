import { describe, expect, it } from 'vitest';
// @ts-expect-error Shared browser module.
import { DEVICE_PROFILE_KEY, normalizeProfile, readDeviceProfile, saveDeviceProfile, clearDeviceProfile } from '../website/shopping-profile.js';
const storage = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
};
describe('guest shopping preferences', () => {
  it('saves and restores an anonymous profile without altering lists', () => {
    const device = storage(); device.setItem('saved-lists', 'existing');
    expect(readDeviceProfile(device)).toMatchObject({ mode: 'pickup', postalCode: '', favorites: {} });
    saveDeviceProfile(device, { city: ' Joliette ', postalCode: 'j6e 2w4', mode: 'delivery', favorites: { maxi: 'branch-1' }, token: 'discard' });
    expect(readDeviceProfile(device)).toMatchObject({ city: 'Joliette', postalCode: 'J6E2W4', favorites: { maxi: 'branch-1' } });
    expect(readDeviceProfile(device)).not.toHaveProperty('token');
    clearDeviceProfile(device); expect(device.getItem('saved-lists')).toBe('existing');
  });
  it('preserves corrupt or newer data and reports blocked/quota storage', () => {
    const device = storage(); device.setItem(DEVICE_PROFILE_KEY, '{broken');
    expect(() => readDeviceProfile(device)).toThrow('illisibles'); expect(device.getItem(DEVICE_PROFILE_KEY)).toBe('{broken');
    device.setItem(DEVICE_PROFILE_KEY, JSON.stringify({ version: 2, profile: {} })); expect(() => readDeviceProfile(device)).toThrow();
    expect(() => saveDeviceProfile({ setItem() { throw new Error('quota'); } }, {})).toThrow('non enregistrées');
    expect(() => readDeviceProfile({ getItem() { throw new Error('blocked'); } })).toThrow('bloque');
  });
  it('validates the same fields as accounts and rejects invalid choices', () => {
    for (const profile of [null, [], { mode: 'unknown' }, { name: 'x'.repeat(101) }, { postalCode: 'K1A0B1' }, { favorites: [] }, { favorites: { maxi: 'https://evil.test' } }]) expect(() => normalizeProfile(profile)).toThrow();
    const result = normalizeProfile({ favorites: { constructor: 'valid-branch' } });
    expect(Object.getPrototypeOf(result.favorites)).toBe(Object.prototype);
    expect(Object.keys(result.favorites)).toEqual(['constructor']);
  });
});
