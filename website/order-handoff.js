// These are verified retailer entry pages, not undocumented cart APIs.
const services = [
  { match: /^maxi$/, name: 'Maxi', url: 'https://www.maxi.ca/' },
  { match: /^superc$/, name: 'Super C', url: 'https://www.superc.ca/' },
  { match: /^metro$/, name: 'Metro', url: 'https://www.metro.ca/' },
  { match: /^iga$/, name: 'IGA', url: 'https://www.iga.ca/fr/magasiner-iga-en-ligne' },
];
export function retailerService(store) {
  const name = String(store.name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  return services.find(service => service.match.test(name)) ?? null;
}
export function storeListText(store) {
  return [store.name, store.address, ...store.items.map(item =>
    `${item.name}${item.offerEvidence?.formatLabel ? ` · ${item.offerEvidence.formatLabel}` : ''} — ${item.price}`),
  'Prix de la liste enregistrée. À confirmer au moment de commander.'].filter(Boolean).join('\n');
}

export const ORDER_UNITS = [['each', 'unité'], ['package', 'paquet'], ['pound', 'lb'], ['kilogram', 'kg'], ['gram', 'g'], ['liter', 'L'], ['milliliter', 'ml']];
const unitMap = { lb: 'pound', kg: 'kilogram', '100g': 'gram', g: 'gram', L: 'liter', l: 'liter', ml: 'milliliter' };
export function orderItems(store) {
  return store.items.map(item => ({ name: item.name, format: item.offerEvidence?.formatLabel || '',
    quantity: item.unit === '100g' ? 100 : 1, unit: unitMap[item.unit] || 'each' }));
}
export function normalizeOrder(input) {
  if (!input || typeof input !== 'object' || typeof input.storeName !== 'string' ||
      !input.storeName.trim() || input.storeName.length > 120 || !Array.isArray(input.items) || !input.items.length || input.items.length > 100) {
    throw new Error('Choisis de 1 à 100 produits pour cette commande.');
  }
  return { storeName: input.storeName.trim(), items: input.items.map(item => {
    if (!item || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 240 ||
        typeof item.format !== 'string' || item.format.length > 120 || !Number.isFinite(item.quantity) ||
        item.quantity <= 0 || item.quantity > 10000 || !ORDER_UNITS.some(([unit]) => unit === item.unit)) {
      throw new Error('Vérifie les noms, formats et quantités des produits.');
    }
    if (['each', 'package'].includes(item.unit) && !Number.isInteger(item.quantity)) throw new Error('Utilise un nombre entier pour les unités et les paquets.');
    return { name: item.name.trim(), format: item.format.trim(), quantity: item.quantity, unit: item.unit };
  }) };
}
export function orderText(input) {
  const order = normalizeOrder(input);
  return [order.storeName, ...order.items.map(item => `${item.quantity} ${ORDER_UNITS.find(([unit]) => unit === item.unit)[1]} · ${item.name}${item.format ? ` · ${item.format}` : ''}`),
    'Vérifier les produits, la succursale et les prix avant de commander.'].join('\n');
}
export function instacartPayload(input) {
  const order = normalizeOrder(input);
  return { title: `Ma liste d’épicerie · ${order.storeName}`, link_type: 'shopping_list', expires_in: 7,
    instructions: [`Sélectionne ${order.storeName} si cette épicerie est disponible pour ton adresse. Vérifie chaque produit, format et quantité avant de l’ajouter. Les prix de circulaire ne sont pas garantis en ligne.`],
    line_items: order.items.map(item => ({ name: [item.name, item.format].filter(Boolean).join(' · '),
      display_text: [item.name, item.format].filter(Boolean).join(' · '),
      line_item_measurements: [{ quantity: item.quantity, unit: item.unit }] })) };
}
export function validInstacartUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['instacart.com', 'www.instacart.com', 'instacart.ca', 'www.instacart.ca'].includes(url.hostname);
  } catch { return false; }
}
