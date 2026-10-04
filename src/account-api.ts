import { createClerkClient } from '@clerk/backend';
import { frFR } from '@clerk/localizations/fr-FR';
import { AccountInputError, parseProfile, parseSnapshot, type AccountRepository } from './account-data.js';
import { accountStore } from './account-store.js';

export interface AccountEnv {
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
  DATABASE_URL?: string;
  ACCOUNT_ORIGINS?: string;
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff' },
});
async function limitedBody(request: Request) {
  const reader = request.body?.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  if (!reader) return '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 500_000) { await reader.cancel(); return null; }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
export const accountOrigins = (env: AccountEnv) => (env.ACCOUNT_ORIGINS ?? 'http://localhost:4187,http://127.0.0.1:4187')
  .split(',').map(value => value.trim()).filter(Boolean);

export async function accountResponse(request: Request, env: AccountEnv,
  dependencies?: { authenticate: (request: Request) => Promise<string | null>; repository: AccountRepository }) {
  const url = new URL(request.url), route = url.pathname.replace(/^\/api\/account/, '').replace(/\/$/, '');
  const configured = Boolean(env.CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY && env.DATABASE_URL);
  const allowed = accountOrigins(env);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const developmentOnPublicHost = env.CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_') && !local;
  if (route === '/config' && request.method === 'GET') {
    return json(200, { enabled: configured && !developmentOnPublicHost,
      publishableKey: configured && !developmentOnPublicHost ? env.CLERK_PUBLISHABLE_KEY : null,
      ...(configured && !developmentOnPublicHost ? { localization: frFR } : {}) });
  }
  if (!configured || developmentOnPublicHost) return json(503, { error: 'Les comptes ne sont pas encore disponibles ici.' });
  if (!allowed.includes(url.origin) || (request.headers.get('origin') && !allowed.includes(request.headers.get('origin')!))) {
    return json(403, { error: 'Origine non autorisée.' });
  }
  // Bearer-only API: no cookie-only mutation and no caller-supplied owner ID.
  if (!/^Bearer \S+$/.test(request.headers.get('authorization') ?? '')) return json(401, { error: 'Connecte-toi pour accéder à tes listes.' });
  let owner: string | null = null;
  try {
    if (dependencies) owner = await dependencies.authenticate(request);
    else {
      const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY!, publishableKey: env.CLERK_PUBLISHABLE_KEY! });
      const state = await clerk.authenticateRequest(request, { authorizedParties: allowed });
      owner = state.toAuth()?.userId ?? null;
    }
  } catch { return json(401, { error: 'Session expirée. Reconnecte-toi.' }); }
  if (!owner) return json(401, { error: 'Session expirée. Reconnecte-toi.' });
  const repository = dependencies?.repository ?? accountStore(env.DATABASE_URL!);
  try {
    if (route === '/profile' && request.method === 'GET') return json(200, { profile: await repository.profile(owner) });
    if (route === '/lists' && request.method === 'GET') return json(200, { lists: await repository.lists(owner) });
    if (route === '/data' && request.method === 'DELETE') {
      await repository.clear(owner);
      return json(200, { ok: true });
    }
    if (route.startsWith('/lists/') && request.method === 'DELETE') {
      const id = decodeURIComponent(route.slice('/lists/'.length));
      if (!/^[a-z0-9-]+:[a-z0-9-]+$/i.test(id) || id.length > 200) throw new AccountInputError('Liste invalide.');
      await repository.removeList(owner, id);
      return json(200, { ok: true });
    }
    if (request.method !== 'PUT' || !['/profile', '/lists'].includes(route)) return json(404, { error: 'Action introuvable.' });
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json(415, { error: 'Format JSON requis.' });
    const bodyText = await limitedBody(request);
    if (bodyText === null) return json(413, { error: 'Cette liste est trop volumineuse.' });
    let body;
    try { body = JSON.parse(bodyText); } catch { throw new AccountInputError('Données illisibles.'); }
    if (route === '/profile') return json(200, { profile: await repository.saveProfile(owner, parseProfile(body)) });
    const snapshot = parseSnapshot(body?.snapshot);
    const saved = await repository.saveList(owner, snapshot, body.importOnly === true);
    return json(200, { saved });
  } catch (error) {
    if (error instanceof AccountInputError) return json(400, { error: error.message });
    // Database / identity-provider errors may contain credentials or personal data.
    return json(503, { error: 'Enregistrement indisponible. Tes listes sur cet appareil sont conservées. Réessaie.' });
  }
}
