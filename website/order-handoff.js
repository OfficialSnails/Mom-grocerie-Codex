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
