// Public shopping-list handoff: no Clerk session or private account access.
// Official API: docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page
// @ts-expect-error Shared validation with the browser review form.
import { instacartPayload, validInstacartUrl } from '../website/order-handoff.js';
export interface OrderEnv { INSTACART_API_KEY?: string; }
const endpoint = 'https://connect.instacart.com';
const send = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});
// Bounded per-instance protection, supplemented by the host/provider's production quotas.
const clients = new Map<string, { count: number; expires: number }>();
function allow(request: Request) {
  const now = Date.now();
  for (const [key, value] of clients) if (value.expires <= now) clients.delete(key);
  const key = request.headers.get('cf-connecting-ip') || 'local';
  const value = clients.get(key) || { count: 0, expires: now + 60_000 };
  if (value.count >= 12 || (!clients.has(key) && clients.size >= 2000)) return false;
  value.count++; clients.set(key, value); return true;
}
async function bodyText(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder(); let text = '', size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) return text + decoder.decode();
      size += part.value.byteLength;
      if (size > 60_000) { await reader.cancel(); return null; }
      text += decoder.decode(part.value, { stream: true });
    }
  } finally { reader.releaseLock(); }
}
export async function orderResponse(request: Request, env: OrderEnv, dependencies: { fetch?: typeof fetch; allow?: (request: Request) => boolean } = {}) {
  const url = new URL(request.url), key = env.INSTACART_API_KEY?.trim();
  if (url.pathname === '/api/order/config' && request.method === 'GET') return send(200, { instacart: Boolean(key) });
  const nearby = url.pathname === '/api/order/retailers' && request.method === 'GET';
  const create = url.pathname === '/api/order/instacart' && request.method === 'POST';
  if (!nearby && !create) return send(404, { error: 'Service introuvable.' });
  if ((request.headers.get('origin') && request.headers.get('origin') !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    return send(403, { error: 'Origine non autorisée.' });
  }
  if (create && request.headers.get('origin') !== url.origin) return send(403, { error: 'Origine requise.' });
  if (!key) return send(503, { error: 'Le transfert Instacart n’est pas encore disponible. Tu peux copier ta liste ou ouvrir le site de l’épicerie.' });
  let payload: unknown, postal = '';
  if (nearby) {
    postal = (url.searchParams.get('postalCode') || '').replace(/\s/g, '').toUpperCase();
    if (!/^[GHJ][0-9][A-Z][0-9][A-Z][0-9]$/.test(postal)) return send(400, { error: 'Entre un code postal du Québec valide.' });
  } else {
    if (!request.headers.get('content-type')?.startsWith('application/json')) return send(415, { error: 'Format JSON requis.' });
    let body;
    try { body = await bodyText(request); }
    catch { return send(400, { error: 'La liste n’a pas pu être lue. Réessaie.' }); }
    if (body === null) return send(413, { error: 'La liste est trop volumineuse.' });
    try { payload = instacartPayload(JSON.parse(body)); }
    catch { return send(400, { error: 'Vérifie les produits et les quantités de ta commande.' }); }
  }
  if (!(dependencies.allow || allow)(request)) return send(429, { error: 'Trop de demandes. Réessaie dans une minute.' });
  try {
    const address = nearby ? `${endpoint}/idp/v1/retailers?${new URLSearchParams({ postal_code: postal, country_code: 'CA' })}` : `${endpoint}/idp/v1/products/products_link`;
    const response = await (dependencies.fetch || fetch)(address, { method: nearby ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', 'Content-Type': 'application/json', 'Accept-Language': 'fr-CA' },
      ...(create ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return send(502, { error: 'Instacart n’a pas confirmé la demande. Ta liste est conservée; aucun achat n’a été effectué.' });
    const data = await response.json() as { retailers?: Array<{ name?: string; retailer_key?: string }>; products_link_url?: string };
    if (nearby) {
      if (!Array.isArray(data.retailers)) throw new Error('Invalid retailer response');
      return send(200, { retailers: data.retailers.filter(item => typeof item?.name === 'string' && typeof item.retailer_key === 'string')
        .slice(0, 100).map(item => ({ name: item.name, key: item.retailer_key })) });
    }
    if (!validInstacartUrl(data.products_link_url)) throw new Error('Invalid shopping link');
    return send(200, { url: data.products_link_url });
  } catch {
    // Never expose provider bodies/keys or retry an uncertain creation automatically.
    return send(502, { error: 'Le transfert n’a pas pu être confirmé. Ta liste est conservée. Réessaie plus tard.' });
  }
}
