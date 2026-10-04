import { orderResponse, type OrderEnv } from '../../../src/order-api.js';
export function onRequest(context: { request: Request; env: OrderEnv }) {
  return orderResponse(context.request, context.env);
}
