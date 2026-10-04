// @ts-expect-error Shared snapshot validation with the static website.
import { validSnapshot } from '../website/saved-lists.js';

export class AccountInputError extends Error {}
const text = (value: unknown, max: number) => {
  if (typeof value !== 'string' || value.length > max) throw new AccountInputError('Champ invalide ou trop long.');
  return value.trim();
};
export function parseProfile(input: unknown) {
  if (!input || typeof input !== 'object') throw new AccountInputError('Profil invalide.');
  const data = input as Record<string, unknown>;
  const favorites: Record<string, string> = {};
  if (data.favorites !== undefined) {
    if (!data.favorites || typeof data.favorites !== 'object' || Array.isArray(data.favorites) || Object.keys(data.favorites).length > 30) throw new AccountInputError('Succursales invalides.');
    for (const [chain, branch] of Object.entries(data.favorites)) {
      if (!/^[a-z0-9-]{1,80}$/.test(chain) || typeof branch !== 'string' || !/^[a-zA-Z0-9:_-]{1,180}$/.test(branch)) throw new AccountInputError('Succursale invalide.');
      favorites[chain] = branch;
    }
  }
  const profile = {
    name: text(data.name ?? '', 100), street: text(data.street ?? '', 200),
    apartment: text(data.apartment ?? '', 40), city: text(data.city ?? '', 100),
    postalCode: text(data.postalCode ?? '', 7).replace(/\s/g, '').toUpperCase(),
    province: 'QC', country: 'CA', mode: data.mode ?? 'pickup', favorites,
  };
  if (profile.postalCode && !/^[GHJ][0-9][A-Z][0-9][A-Z][0-9]$/.test(profile.postalCode)) {
    throw new AccountInputError('Entre un code postal du Québec valide.');
  }
  if (!['pickup', 'delivery', 'in_store'].includes(String(profile.mode))) throw new AccountInputError('Mode de courses invalide.');
  return profile;
}

export function parseSnapshot(input: unknown): Record<string, any> {
  try {
    if (!validSnapshot(input)) throw new Error();
    const snapshot = input as Record<string, any>;
    if (!/^[a-z0-9-]+:[a-z0-9-]+$/i.test(snapshot.id) || snapshot.id.length > 200 ||
      snapshot.notes.length > 5000 || snapshot.stores.length > 30 ||
      snapshot.stores.some((store: any) => store.items.length > 500)) throw new Error();
    return snapshot;
  } catch { throw new AccountInputError('Liste invalide. Les données existantes ont été conservées.'); }
}

export interface AccountRepository {
  profile(owner: string): Promise<unknown>;
  saveProfile(owner: string, profile: unknown): Promise<unknown>;
  lists(owner: string): Promise<unknown[]>;
  saveList(owner: string, snapshot: Record<string, any>, importOnly: boolean): Promise<boolean>;
  removeList(owner: string, id: string): Promise<void>;
  clear(owner: string): Promise<void>;
}
