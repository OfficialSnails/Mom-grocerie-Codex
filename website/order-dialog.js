import { ORDER_UNITS, orderItems, normalizeOrder, orderText, retailerService, validInstacartUrl } from './order-handoff.js';

const DRAFT_KEY = 'bons-speciaux:order-drafts:v1';
const node = (tag, text, className = '') => {
  const element = document.createElement(tag); element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const caption = text => node('p', text, 'account-caption');
function external(label, url) {
  const link = node('a', label, 'account-button');
  link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
}
async function orderApi(path, body) {
  const response = await fetch(`/api/order/${path}`, { method: body ? 'POST' : 'GET', cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(16_000) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Le transfert en ligne est indisponible. Tu peux copier ta liste.');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Service indisponible. Ta liste est conservée.');
  return data;
}
export function showOrderDialog(store, snapshot, profile, trigger = document.activeElement) {
  const dialog = node('dialog', undefined, 'order-dialog');
  dialog.setAttribute('aria-labelledby', 'order-title');
  const heading = node('header', undefined, 'order-heading'), title = node('h2', `Commander chez ${store.name}`); title.id = 'order-title';
  const close = node('button', '×', 'order-close'); close.type = 'button'; close.setAttribute('aria-label', 'Fermer la préparation de commande');
  close.addEventListener('click', () => dialog.close()); heading.append(title, close);
  const status = node('p', undefined, 'order-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const form = node('form', undefined, 'order-form'); form.addEventListener('submit', event => event.preventDefault());
  const identity = `${snapshot.id}:${store.id}:${snapshot.savedAt}`;
  let drafts = {}, draft, cached;
  try {
    drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
    if (!drafts || typeof drafts !== 'object' || Array.isArray(drafts)) throw new Error('Invalid draft');
    draft = drafts[identity]?.order;
    if (draft) draft = normalizeOrder(draft);
    cached = drafts[identity]?.link;
  } catch { status.textContent = 'Le brouillon précédent est illisible. La liste enregistrée est conservée.'; drafts = {}; draft = undefined; cached = undefined; }
  draft ||= { storeName: store.name, items: orderItems(store) };
  const rows = [];
  for (const [index, item] of draft.items.entries()) {
    const row = node('fieldset', undefined, 'order-item'), legend = node('legend', `Produit ${index + 1}`);
    const includeLabel = node('label', undefined, 'order-include'), include = node('input'); include.type = 'checkbox'; include.checked = true;
    includeLabel.append(include, node('span', 'Inclure'));
    const field = (label, value, name, type = 'text') => {
      const host = node('label', label), input = node('input'); input.type = type; input.name = `${name}-${index}`; input.value = value;
      input.required = true; host.append(input); row.append(host); return input;
    };
    row.append(legend, includeLabel);
    const name = field('Produit souhaité', item.name, 'product'); name.maxLength = 240;
    const format = field('Format / marque à vérifier', item.format, 'format'); format.required = false; format.maxLength = 120;
    const quantity = field('Quantité', item.quantity, 'quantity', 'number'); quantity.min = '0.001'; quantity.max = '10000'; quantity.step = 'any';
    const unitLabel = node('label', 'Unité'), unit = node('select'); unit.name = `unit-${index}`;
    for (const [value, label] of ORDER_UNITS) { const option = node('option', label); option.value = value; unit.append(option); }
    unit.value = item.unit; const unitControl = node('span', undefined, 'account-select'); unitControl.append(unit); unitLabel.append(unitControl); row.append(unitLabel);
    if (/\sou\s/i.test(item.name)) row.append(caption('Cette offre propose des choix. Précise le produit souhaité avant le transfert.'));
    include.addEventListener('change', () => {
      for (const input of [name, format, quantity, unit]) input.disabled = !include.checked;
    });
    rows.push({ include, name, format, quantity, unit }); form.append(row);
  }
  function collect() {
    if (!form.reportValidity()) throw new Error('Vérifie les champs de la commande.');
    return normalizeOrder({ storeName: store.name, items: rows.filter(row => row.include.checked).map(row => ({
      name: row.name.value, format: row.format.value, quantity: Number(row.quantity.value), unit: row.unit.value,
    })) });
  }
  function remember(order, link = cached) {
    const signature = JSON.stringify(order);
    const record = { order, updatedAt: Date.now(), ...(link?.signature === signature ? { link } : {}) };
    const entries = Object.entries(drafts).filter(([key]) => key !== identity).sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0)).slice(0, 19);
    drafts = Object.fromEntries([...entries, [identity, record]]);
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts)); }
    catch { throw new Error('Le brouillon ne peut pas être enregistré. Vérifie l’espace de ce navigateur.'); }
  }
  function button(label, run, primary = false, disabled = () => false) {
    const control = node('button', label, primary ? 'primary' : ''); control.type = 'button';
    control.addEventListener('click', async () => {
      control.disabled = true; status.textContent = '';
      try { await run(); } catch (error) { status.textContent = error.message || 'Action indisponible. Ta liste est conservée.'; }
      finally { control.disabled = disabled(); }
    }); return control;
  }
  const actions = node('div', undefined, 'account-actions'), service = retailerService(store);
  actions.append(button('Enregistrer mon brouillon', () => { remember(collect()); status.textContent = 'Brouillon enregistré sur cet appareil. Les prix de ta liste restent inchangés.'; }),
    button('Copier les produits', async () => {
      const order = collect(); remember(order);
      try { await navigator.clipboard.writeText(orderText(order)); status.textContent = 'Produits et quantités copiés. Ajoute-les sur le site de l’épicerie.'; }
      catch { const text = node('textarea'); text.readOnly = true; text.value = orderText(order); text.setAttribute('aria-label', 'Liste à copier'); form.append(text); text.focus(); text.select(); status.textContent = 'Copie cette sélection avec le menu de ton appareil.'; }
    }));
  if (service) actions.append(external(`Ouvrir ${service.name}`, service.url));
  const manual = node('details', undefined, 'order-manual');
  manual.append(node('summary', 'Autres options : copier ou ouvrir l’épicerie'));
  const secondary = node('div', undefined, 'account-actions');
  while (actions.children.length > 1) secondary.append(actions.children[1]);
  manual.append(secondary);
  const integration = node('section', undefined, 'order-integration');
  integration.append(node('h3', 'Transférer vers Instacart'), caption('Vérification du service…'));
  const body = node('div', undefined, 'order-body');
  body.append(caption(store.address || 'Confirme la succursale sur le site de l’épicerie.'),
    caption('Tous les produits de cette épicerie sont repris ci-dessous. Une fois le service activé, le transfert enverra la liste entière.'),
    integration, form, actions, manual, status,
    caption('Aucun achat ici. Le panier, les formats disponibles, la succursale et les frais sont confirmés chez le commerçant.'));
  dialog.append(heading, body);
  document.body.append(dialog);
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    dialog.remove();
    const target = trigger?.isConnected ? trigger : document.querySelector('#account-main');
    target?.focus({ preventScroll: true });
  });
  dialog.showModal();
  void (async () => {
    try {
      const config = await orderApi('config');
      if (!dialog.isConnected) return;
      integration.replaceChildren(node('h3', 'Transférer vers Instacart'));
      if (!config.instacart) {
        integration.append(caption('Le transfert de la liste entière n’est pas encore activé : l’accès au service de commande manque. Ta liste est enregistrable sur cet appareil.'));
        return;
      }
      const postalLabel = node('label', 'Code postal de livraison'), postal = node('input'); postal.value = profile.postalCode || ''; postal.maxLength = 7; postal.autocomplete = 'postal-code'; postalLabel.append(postal);
      const available = node('p', undefined, 'account-caption'), destination = node('div', undefined, 'account-actions');
      let verifiedPostal = '', retailerAvailable = false;
      const transfer = button('Transférer toute la liste vers Instacart', async () => {
        if (!retailerAvailable || postal.value.replace(/\s/g, '').toUpperCase() !== verifiedPostal) throw new Error('Vérifie à nouveau les épiceries pour ce code postal.');
        const order = collect(), signature = JSON.stringify(order); remember(order);
        let url;
        if (cached?.signature === signature && cached.expires > Date.now() && validInstacartUrl(cached.url)) url = cached.url;
        else {
          const result = await orderApi('instacart', order);
          if (!validInstacartUrl(result.url)) throw new Error('Lien Instacart invalide.');
          url = result.url; cached = { url, signature, expires: Date.now() + 6 * 86400000 };
        }
        // Render the confirmed destination before caching: a storage failure must not lose a created link.
        destination.replaceChildren(external('Vérifier les produits sur Instacart', url));
        status.textContent = `Liste transmise. Sélectionne ${store.name} sur Instacart, puis vérifie les produits et quantités.`;
        remember(order);
      }, true, () => !retailerAvailable || postal.value.replace(/\s/g, '').toUpperCase() !== verifiedPostal); transfer.disabled = true;
      const lookup = button('Vérifier les épiceries disponibles', async () => {
        transfer.disabled = true; retailerAvailable = false; verifiedPostal = ''; destination.replaceChildren();
        const code = postal.value.replace(/\s/g, '').toUpperCase();
        if (!/^[GHJ][0-9][A-Z][0-9][A-Z][0-9]$/.test(code)) throw new Error('Entre un code postal du Québec valide.');
        const result = await orderApi(`retailers?postalCode=${encodeURIComponent(code)}`);
        if (code !== postal.value.replace(/\s/g, '').toUpperCase()) return;
        verifiedPostal = code;
        const names = result.retailers.map(item => item.name);
        const key = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const found = names.some(name => key(name) === key(store.name));
        available.textContent = found ? `${store.name} figure dans les épiceries proposées pour ce secteur. La succursale et la livraison restent à confirmer sur Instacart.`
          : names.length ? `${store.name} n’a pas été confirmé. Épiceries proposées : ${names.join(', ')}. Utilise le site de l’épicerie ou choisis une autre liste.`
            : 'Aucune épicerie retournée pour ce code postal. Essaie le site de l’épicerie.';
        retailerAvailable = found; transfer.disabled = !found;
      });
      postal.addEventListener('input', () => { transfer.disabled = true; retailerAvailable = false; verifiedPostal = ''; available.textContent = ''; destination.replaceChildren(); });
      form.addEventListener('input', () => destination.replaceChildren());
      integration.append(caption('Le code postal sert à vérifier le secteur auprès d’Instacart. Seuls les produits et quantités seront transmis avec la liste; ton adresse complète reste ici.'),
        postalLabel, lookup, available, transfer, destination,
        caption('Instacart choisit un magasin par défaut : sélectionne ton épicerie et vérifie les correspondances avant d’ajouter au panier.'));
    } catch (error) { if (dialog.isConnected) integration.replaceChildren(node('h3', 'Transfert indisponible'), caption(error.message)); }
  })();
}
