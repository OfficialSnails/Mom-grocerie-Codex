// @ts-expect-error Shared snapshot validation with the static website.
import { validSnapshot } from '../website/saved-lists.js';

export class AccountInputError extends Error {}
// @ts-expect-error Profile validation is shared with the guest browser flow.
import { normalizeProfile } from '../website/shopping-profile.js';
export function parseProfile(input: unknown) {
  try { return normalizeProfile(input); }
  catch (error) { throw new AccountInputError(error instanceof Error ? error.message : 'Profil invalide.'); }
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
