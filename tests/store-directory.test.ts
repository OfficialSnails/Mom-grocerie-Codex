import { describe, expect, it } from 'vitest';
import sourceDirectory from '../website/data/store-locations.json';
// Preserve regression coverage for legacy branch choices independently of directory growth.
const directory = { stores: sourceDirectory.stores, branches: sourceDirectory.branches.filter(branch => !('chainId' in branch)) };
// @ts-expect-error Shared static browser/PDF module.
import { availableBranches, selectedBranch, storeAddress } from '../website/store-directory.js';

describe('saved grocery branches', () => {
  const item = { storeId: 'intermarche-joliette', storeAddress: 'Joliette', currentPrice: 2.49 };
  const choices = { 'intermarche-joliette': 'intermarche-saint-esprit-rivest' };

  it('finds a branch by accented city, street or spaced postal code', () => {
    for (const query of ['saint esprit', '31 rue rivest', 'j0k2l0']) {
      expect(availableBranches(directory, 'joliette', item.storeId, query)).toHaveLength(1);
    }
    expect(availableBranches(directory, 'montreal', 'intermarche-montreal', 'Montreal')).toHaveLength(1);
    expect(availableBranches(directory, 'joliette', item.storeId, 'Québec')).toEqual([]);
  });

  it('uses the same saved address for the basket and both PDF paths without changing the offer', () => {
    expect(storeAddress(item, directory, 'joliette', choices)).toBe('31, rue Rivest, Saint-Esprit J0K 2L0');
    expect(item).toEqual({ storeId: 'intermarche-joliette', storeAddress: 'Joliette', currentPrice: 2.49 });
  });

  it('rejects a branch from another store or region, including in PDF requests', () => {
    const wrongBranch = { 'intermarche-joliette': 'intermarche-montreal-boyer' };
    expect(storeAddress(item, directory, 'joliette', wrongBranch)).toBe('');
    expect(selectedBranch(directory, 'montreal', item.storeId, choices)).toBeUndefined();
    expect(availableBranches(directory, 'joliette', 'metro-joliette')).toEqual([]);
    expect(storeAddress(item, directory, 'joliette', { [item.storeId]: 'unknown' })).toBe('');
  });

  it('preserves the existing default addresses and never applies Joliette overrides to another region', () => {
    expect(storeAddress({ storeId: 'familiprix-joliette' }, directory, 'joliette')).toBe('157 rue Beaudry Nord, Joliette');
    expect(storeAddress({ storeId: 'familiprix-montreal', storeAddress: '' }, directory, 'montreal')).toBe('');
    expect(storeAddress({ storeId: 'metro-joliette', storeAddress: '180 rue Beaudry N, Joliette' }, directory, 'joliette')).toBe('180 rue Beaudry N, Joliette');
  });

  it('keeps incomplete coverage explicit and carries provenance for every selectable branch', () => {
    expect(availableBranches(directory, 'quebec', 'intermarche-quebec')).toEqual([]);
    for (const branch of directory.branches) {
      expect(branch.source).toMatch(/^https:\/\//);
      expect(branch.verifiedAt).toBe('2026-10-03');
      expect(branch.street).toMatch(/^\d/);
    }
  });
});
