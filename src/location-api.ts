import type { ServerResponse } from 'http';

export async function locationResponse(url: URL, apiKey?: string): Promise<Response> {
  const send = (status: number, payload: unknown) => new Response(JSON.stringify(payload), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
  const key = apiKey?.trim();
  const path = url.pathname.replace(/\/$/, '');
  if (path === '/api/location/config') return send(200, { addressSearch: Boolean(key) });
  if (path !== '/api/location/search') return send(404, { error: 'Adresse introuvable.' });
  if (!key) return send(503, { error: 'La recherche d’adresse est indisponible. Choisis une ville ou utilise ta position.' });
  const query = (url.searchParams.get('q') ?? '').trim();
  if (query.length < 3 || query.length > 200) return send(400, { error: 'Entre une adresse de 3 à 200 caractères.' });
  const endpoint = new URL('https://api.geoapify.com/v1/geocode/search');
  endpoint.search = new URLSearchParams({ text: query, format: 'json', lang: 'fr', filter: 'countrycode:ca', limit: '6', apiKey: key }).toString();
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return send(502, { error: 'Le service d’adresses est indisponible. Essaie une ville.' });
    const data = await response.json() as { results?: Array<Record<string, unknown>> };
    const results = (data.results ?? []).filter(item =>
      Number.isFinite(item.lat) && Number.isFinite(item.lon) &&
      (item.state_code === 'QC' || ['Québec', 'Quebec'].includes(String(item.state))))
      .map(item => ({ name: String(item.formatted ?? item.city ?? ''), lat: item.lat, lon: item.lon }));
    return send(200, { results });
  } catch {
    // Provider errors can contain the API key; never pass those through or log the URL.
    return send(502, { error: 'La recherche a échoué. Réessaie ou choisis une ville.' });
  }
}

export async function handleLocationApi(url: URL, res: ServerResponse) {
  const response = await locationResponse(url, process.env.GEOAPIFY_API_KEY);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
}
