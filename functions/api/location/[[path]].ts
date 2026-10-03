import { locationResponse } from '../../../src/location-api.js';

export function onRequest(context: { request: Request; env: { GEOAPIFY_API_KEY?: string } }) {
  if (context.request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
  }
  return locationResponse(new URL(context.request.url), context.env.GEOAPIFY_API_KEY);
}
