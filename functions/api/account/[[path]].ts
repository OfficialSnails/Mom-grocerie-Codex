import { accountResponse, type AccountEnv } from '../../../src/account-api.js';

export function onRequest(context: { request: Request; env: AccountEnv }) {
  return accountResponse(context.request, context.env);
}
