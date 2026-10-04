import { describe, expect, it, vi } from 'vitest';
import { orderResponse } from '../src/order-api.js';
// @ts-expect-error Browser module shared with the server.
import { instacartPayload, normalizeOrder, orderItems, orderText, validInstacartUrl } from '../website/order-handoff.js';

const order = { storeName: 'Maxi', items: [{ name: 'Carottes', format: 'Sac de 3 lb', quantity: 2, unit: 'each' }] };
const env = { INSTACART_API_KEY: 'unit-test-key' };
const url = 'https://www.instacart.com/store/shopping_lists/test';
const request = (path = 'instacart', body: unknown = order, headers = {}) => new Request(`https://example.test/api/order/${path}`, {
  method: 'POST', headers: { Origin: 'https://example.test', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const dependencies = (body: unknown = { products_link_url: url }) => ({ fetch: vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json(body)), allow: () => true });

describe('reviewed grocery orders', () => {
  it('keeps the chosen product, package and quantity without inventing product IDs or sending personal data', () => {
    const payload = instacartPayload({ ...order, street: 'Private address', postalCode: 'J6E2W4', ownerId: 'private', items: [{ ...order.items[0], price: '.99', id: 'flyer-only-id' }] });
    expect(payload.line_items).toEqual([{ name: 'Carottes · Sac de 3 lb', display_text: 'Carottes · Sac de 3 lb', line_item_measurements: [{ quantity: 2, unit: 'each' }] }]);
    expect(payload.link_type).toBe('shopping_list');
    expect(JSON.stringify(payload)).not.toMatch(/Private address|J6E2W4|flyer-only-id|\.99|ownerId/);
    expect(orderText(order)).toContain('2 unité · Carottes · Sac de 3 lb');
  });
  it('uses weight units when recorded and leaves combined flyer choices for review', () => {
    expect(orderItems({ items: [{ name: 'Carottes ou oignons', unit: 'each' }, { name: 'Fromage', unit: '100g' }, { name: 'Bananes', unit: 'lb' }] })).toEqual([
      { name: 'Carottes ou oignons', format: '', quantity: 1, unit: 'each' },
      { name: 'Fromage', format: '', quantity: 100, unit: 'gram' },
      { name: 'Bananes', format: '', quantity: 1, unit: 'pound' },
    ]);
  });
  it.each([0, -1, Infinity, NaN, 10001, 1.5])('rejects invalid package quantity %s', quantity => {
    expect(() => normalizeOrder({ ...order, items: [{ ...order.items[0], quantity }] })).toThrow();
  });
  it('rejects empty/oversized lists and unsupported units but accepts fractional weight', () => {
    for (const items of [[], Array(101).fill(order.items[0]), [{ ...order.items[0], name: '' }], [{ ...order.items[0], unit: 'invented' }]]) expect(() => normalizeOrder({ ...order, items })).toThrow();
    expect(normalizeOrder({ ...order, items: [{ ...order.items[0], quantity: 0.5, unit: 'kilogram' }] }).items[0].quantity).toBe(.5);
  });
  it.each(['https://instacart.com.evil.test/cart', 'https://user:pass@instacart.com/cart', 'http://instacart.com/cart', 'javascript:alert(1)', 'https://instacart.com:999/cart'])('rejects unsafe destination %s', value => expect(validInstacartUrl(value)).toBe(false));
});

describe('public ordering API', () => {
  it('allows guest config and refuses unconfigured transfers without contacting a provider', async () => {
    const dep = dependencies();
    expect(await (await orderResponse(new Request('https://example.test/api/order/config'), {})).json()).toEqual({ instacart: false });
    expect((await orderResponse(request(), {}, dep)).status).toBe(503);
    expect(dep.fetch).not.toHaveBeenCalled();
  });
  it('creates a shopping-list link without Clerk or any private account access', async () => {
    const dep = dependencies();
    const response = await orderResponse(request(), env, dep);
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ url });
    expect(dep.fetch).toHaveBeenCalledOnce();
    const call = dep.fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe('https://connect.instacart.com/idp/v1/products/products_link');
    expect(JSON.parse(call[1].body as string)).toEqual(instacartPayload(order));
    expect(JSON.stringify(await (await orderResponse(new Request('https://example.test/api/order/config'), env)).json())).not.toContain('unit-test-key');
  });
  it('transfers every reviewed item in one provider request', async () => {
    const dep = dependencies();
    const items = [...order.items, { name: 'Lait', format: '2 L', quantity: 1, unit: 'each' }];
    const response = await orderResponse(request('instacart', { ...order, items }), env, dep);
    expect(response.status).toBe(200); expect(dep.fetch).toHaveBeenCalledOnce();
    const payload = JSON.parse(dep.fetch.mock.calls[0][1]?.body as string);
    expect(payload.line_items).toHaveLength(2);
    expect(payload.line_items[1].name).toBe('Lait · 2 L');
  });
  it('checks Quebec service areas against current retailer responses', async () => {
    const dep = dependencies({ retailers: [{ name: 'Maxi', retailer_key: 'maxi', private: 'omit' }, { name: 'Missing key' }] });
    const response = await orderResponse(new Request('https://example.test/api/order/retailers?postalCode=j6e%202w4'), env, dep);
    expect(await response.json()).toEqual({ retailers: [{ name: 'Maxi', key: 'maxi' }] });
    expect(dep.fetch.mock.calls[0][0]).toContain('postal_code=J6E2W4&country_code=CA');
    expect((await orderResponse(new Request('https://example.test/api/order/retailers?postalCode=INVALID'), env, dep)).status).toBe(400);
  });
  it('rejects cross-origin requests, absent origin, invalid JSON and oversized bodies before any transfer', async () => {
    const dep = dependencies();
    for (const headers of [{ Origin: 'https://other.test' }, { Origin: '' }, { 'Sec-Fetch-Site': 'cross-site' }]) expect((await orderResponse(request('instacart', order, headers), env, dep)).status).toBe(403);
    expect((await orderResponse(request('instacart', {}, { 'Content-Type': 'text/plain' }), env, dep)).status).toBe(415);
    expect((await orderResponse(request('instacart', { items: [] }), env, dep)).status).toBe(400);
    expect((await orderResponse(request('instacart', 'x'.repeat(60_001)), env, dep)).status).toBe(413);
    expect(dep.fetch).not.toHaveBeenCalled();
  });
  it('rate limits before contacting the provider', async () => {
    const dep = { ...dependencies(), allow: () => false };
    expect((await orderResponse(request(), env, dep)).status).toBe(429); expect(dep.fetch).not.toHaveBeenCalled();
  });
  it('does not leak provider failures or retry uncertain writes', async () => {
    const dep = dependencies(); dep.fetch.mockRejectedValueOnce(new Error('private provider credential'));
    const response = await orderResponse(request(), env, dep);
    expect(response.status).toBe(502); expect(await response.text()).not.toContain('credential'); expect(dep.fetch).toHaveBeenCalledOnce();
    const badLink = await orderResponse(request(), env, dependencies({ products_link_url: 'https://evil.test' }));
    expect(badLink.status).toBe(502);
  });
});
