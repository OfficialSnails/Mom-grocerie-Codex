import { accountSession, accountApi, saveToAccount } from './account-client.js';
import { readSavedLists, removeSavedList, setListArchived, savedListTotals, SAVED_LISTS_KEY } from './saved-lists.js';
import { createListPdf } from './list-pdf.js';
import { money, productTitle, loyaltyLabel } from './product-details.js';
import { retailerService, storeListText } from './order-handoff.js';
import { mapsUrl } from './location-data.js';

const content = document.querySelector('#account-content'), status = document.querySelector('#account-status');
let clerk, lists = [], profile = {}, requestNumber = 0, activeUser = null;
const node = (tag, text, className = '') => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  element.className = className;
  return element;
};
const signedIn = () => Boolean(clerk?.user);
const countLabel = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
function action(label, callback, className = '') {
  const button = node('button', label, className);
  button.type = 'button';
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = '';
    try { await callback(); } catch (error) { status.textContent = error.message || 'Action indisponible. Réessaie.'; }
    finally { button.disabled = false; }
  });
  return button;
}
function link(label, href, external = false) {
  const element = node('a', label, 'account-button'); element.href = href;
  if (external) { element.target = '_blank'; element.rel = 'noopener noreferrer'; }
  return element;
}
function caption(text) { return node('p', text, 'account-caption'); }
function metric(label, amount, kind = '') {
  const block = node('div', undefined, `account-metric ${kind}`);
  block.append(node('span', label), node('strong', money(amount)));
  return block;
}
function metrics(subtotal, savings) {
  const block = node('div', undefined, 'account-metrics');
  block.append(metric('Total estimé', subtotal), metric('Économies estimées', savings, 'savings'));
  return block;
}

async function refresh() {
  const request = ++requestNumber, owner = clerk?.user?.id ?? null;
  content.setAttribute('aria-busy', 'true');
  try {
    const result = owner ? await Promise.all([accountApi('/lists'), accountApi('/profile')]) : null;
    if (request !== requestNumber || owner !== (clerk?.user?.id ?? null)) return;
    lists = result ? result[0].lists : readSavedLists(localStorage);
    profile = result ? result[1].profile : {};
    renderAuth(); render();
  } catch (error) {
    if (request !== requestNumber) return;
    content.replaceChildren(node('h2', 'Mes listes'), caption(error.message), action('Réessayer', refresh));
  } finally { if (request === requestNumber) content.setAttribute('aria-busy', 'false'); }
}
function renderAuth() {
  document.querySelector('#account-identity').textContent = signedIn()
    ? (profile.name || clerk.user.firstName || 'Mon compte') : 'Listes sur cet appareil';
  const host = document.querySelector('#account-auth'); host.replaceChildren();
  if (signedIn()) host.append(action('Se déconnecter', async () => { await clerk.signOut(); await refresh(); }, 'account-access'));
  else if (clerk) host.append(action('Se connecter', () => clerk.openSignIn({ forceRedirectUrl: location.href }), 'account-access'));
}

function render() {
  const hash = location.hash.slice(1), section = ['profile', 'archives'].includes(hash) ? hash : 'lists';
  document.querySelectorAll('[data-section]').forEach(item => {
    if (item.dataset.section === section) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  content.replaceChildren();
  if (section === 'profile') return renderProfile();
  if (hash.startsWith('list=')) {
    let id;
    try { id = decodeURIComponent(hash.slice(5)); } catch { id = ''; }
    const snapshot = lists.find(list => list.id === id);
    if (snapshot) return renderList(snapshot);
    content.append(node('h2', 'Liste introuvable'), caption('Cette liste n’est pas disponible dans cet espace.'), link('Toutes mes listes', '#lists'));
    return;
  }
  const archived = section === 'archives', visible = lists.filter(list => Boolean(list.archivedAt) === archived);
  content.append(node('h2', archived ? 'Archives' : 'Mes listes'),
    caption(signedIn() ? 'Tes semaines enregistrées dans ton compte.' : 'Tes semaines enregistrées dans ce navigateur.'));
  if (signedIn()) {
    const actions = node('div', undefined, 'account-actions');
    actions.append(action('Importer les listes de cet appareil', async () => {
      const local = readSavedLists(localStorage); let imported = 0;
      for (const snapshot of local) if ((await saveToAccount(snapshot, true)).saved) imported++;
      await refresh();
      status.textContent = imported ? `${countLabel(imported, 'liste importée', 'listes importées')}.` : 'Tes listes sont déjà à jour.';
    }));
    content.append(actions);
  }
  if (!visible.length) { content.append(node('p', 'Aucune liste ici pour le moment. Choisis des produits, puis enregistre ta liste.', 'account-empty'), link('Préparer une liste', './')); return; }
  const totals = savedListTotals(visible);
  content.append(metrics(totals.subtotal, totals.savings), caption(`${countLabel(visible.length, 'semaine')} · Estimations enregistrées, sans confirmation d’achat.`));
  for (const snapshot of visible) {
    const card = node('article', undefined, 'account-card'), entry = node('a', undefined, 'account-list-link');
    entry.href = `#list=${encodeURIComponent(snapshot.id)}`;
    const title = node('span');
    title.append(node('strong', snapshot.week.weekRange), node('small', `${snapshot.week.regionName} · ${countLabel(snapshot.stores.length, 'épicerie')}`));
    const amounts = node('span'); amounts.append(node('strong', money(snapshot.estimate.subtotal)), node('small', `${money(snapshot.savings.amount)} d’économies estimées`));
    entry.append(title, amounts); card.append(entry); content.append(card);
  }
}

function renderList(snapshot) {
  content.append(link('← Mes listes', snapshot.archivedAt ? '#archives' : '#lists'));
  content.append(node('h2', snapshot.week.weekRange), caption(`${snapshot.week.regionName} · Enregistrée le ${new Date(snapshot.savedAt).toLocaleDateString('fr-CA')}`));
  content.append(metrics(snapshot.estimate.subtotal, snapshot.savings.amount), caption('Prix enregistrés · Avant taxes, dépôts, quantités réelles et produits au poids. Les prix à vérifier ne sont pas inclus.'));
  const actions = node('div', undefined, 'account-actions');
  actions.append(action('Télécharger le PDF', async () => { const { pdf, fileName } = await createListPdf(snapshot); pdf.save(fileName); }, 'primary'),
    action(snapshot.archivedAt ? 'Restaurer' : 'Archiver', async () => {
      const next = { ...snapshot };
      if (snapshot.archivedAt) delete next.archivedAt; else next.archivedAt = new Date().toISOString();
      if (signedIn()) await saveToAccount(next);
      else setListArchived(localStorage, snapshot.id, !snapshot.archivedAt);
      await refresh();
    }), action('Supprimer', () => confirmDelete(snapshot), 'danger'));
  content.append(actions);
  if (snapshot.notes) content.append(node('p', snapshot.notes, 'account-note'));
  const fulfillment = node('section', undefined, 'account-fulfillment');
  const preference = { pickup: 'Ramassage', delivery: 'Livraison', in_store: 'En magasin' }[profile.mode];
  fulfillment.append(node('h3', 'Préparer mes courses'));
  if (preference) fulfillment.append(node('p', [preference, profile.city, profile.postalCode].filter(Boolean).join(' · ')));
  fulfillment.append(caption('Une liste par épicerie. Copie les produits, puis ouvre son site pour choisir le service et passer ta commande.'),
    link(signedIn() ? 'Modifier mes préférences' : 'Enregistrer mes préférences', '#profile'));
  content.append(fulfillment);
  for (const store of snapshot.stores) {
    const card = node('section', undefined, 'account-card'), header = node('header');
    header.append(node('h3', store.name), node('p', store.address || 'Succursale à choisir'));
    const body = node('div', undefined, 'account-card-body'), items = node('ul', undefined, 'account-products');
    for (const item of store.items) {
      const row = node('li'), label = node('div'); label.append(node('strong', productTitle(item.name)));
      if (item.offerEvidence?.formatLabel) label.append(node('small', item.offerEvidence.formatLabel));
      if (loyaltyLabel(item)) label.append(node('small', loyaltyLabel(item)));
      row.append(label, node('strong', item.price)); items.append(row);
    }
    body.append(items);
    const subtotal = node('div', undefined, 'account-store-total');
    const variableOnly = !store.estimate.fixedCount && (store.estimate.variableCount || store.estimate.unknownCount);
    subtotal.append(node('span', variableOnly ? 'Selon les quantités' : 'Sous-total estimé'), node('strong', variableOnly ? '—' : money(store.estimate.subtotal)));
    body.append(subtotal);
    const unpriced = (store.estimate.variableCount || 0) + (store.estimate.unknownCount || 0);
    if (unpriced) body.append(caption(`${countLabel(unpriced, 'prix à vérifier')} hors total.`));
    const storeActions = node('div', undefined, 'account-actions'), service = retailerService(store);
    storeActions.append(action('Copier cette liste', async () => {
      await navigator.clipboard.writeText(storeListText(store)); status.textContent = `Liste ${store.name} copiée.`;
    }));
    if (service) { const order = link(`Ouvrir ${service.name} ↗`, service.url, true); order.classList.add('primary'); storeActions.append(order); }
    if (store.address) storeActions.append(link('Voir l’adresse', mapsUrl(store.name, store.address, store.branch), true));
    if (signedIn() && store.branch?.id) {
      const chain = store.branch.chainId || store.id.replace(/-(joliette|montreal|quebec)$/, '');
      const favorite = profile.favorites?.[chain] === store.branch.id;
      storeActions.append(action(favorite ? 'Retirer des favoris' : 'Ma succursale préférée', async () => {
        const favorites = { ...profile.favorites };
        if (favorite) delete favorites[chain]; else favorites[chain] = store.branch.id;
        profile = (await accountApi('/profile', { method: 'PUT', body: { ...profile, favorites } })).profile;
        render(); status.textContent = favorite ? 'Succursale retirée des favoris.' : 'Succursale enregistrée. Elle sera proposée dans sa région.';
      }));
    }
    body.append(storeActions, caption(service
      ? 'Les produits restent à ajouter sur le site de l’épicerie. Confirme la succursale, les prix et les frais avant de payer.'
      : 'Garde cette liste pour tes courses en magasin.'));
    card.append(header, body); content.append(card);
  }
}

function confirmDelete(snapshot) {
  content.replaceChildren(node('h2', 'Supprimer cette liste ?'), caption(`${snapshot.week.weekRange} · ${snapshot.week.regionName}`));
  const actions = node('div', undefined, 'account-actions');
  actions.append(action('Garder la liste', render, 'primary'), action('Supprimer la liste', async () => {
    if (signedIn()) await accountApi(`/lists/${encodeURIComponent(snapshot.id)}`, { method: 'DELETE' });
    else removeSavedList(localStorage, snapshot.id);
    location.hash = 'lists'; await refresh();
  }, 'danger'));
  content.append(actions);
}

function renderProfile() {
  content.append(node('h2', 'Mon profil'));
  if (!signedIn()) { content.append(caption(clerk ? 'Connecte-toi pour enregistrer ton adresse et tes préférences.' : 'Les comptes ne sont pas encore disponibles ici. Tes listes restent sur cet appareil.')); return; }
  content.append(caption('Ces champs sont facultatifs. Ton adresse reste dans ton compte; elle n’est pas envoyée automatiquement aux épiceries.'));
  const form = node('form', undefined, 'account-form');
  for (const [name, label, autocomplete, max] of [
    ['name', 'Nom', 'name', 100], ['street', 'Adresse', 'address-line1', 200],
    ['apartment', 'Appartement', 'address-line2', 40], ['city', 'Ville', 'address-level2', 100],
    ['postalCode', 'Code postal', 'postal-code', 7],
  ]) {
    const field = node('label', label), input = node('input');
    input.name = name; input.autocomplete = autocomplete; input.maxLength = max; input.value = profile[name] || '';
    field.append(input); form.append(field);
  }
  const modeLabel = node('label', 'Je préfère'), select = node('select'); select.name = 'mode';
  for (const [value, label] of [['pickup', 'Ramassage'], ['delivery', 'Livraison'], ['in_store', 'En magasin']]) {
    const option = node('option', label); option.value = value; select.append(option);
  }
  select.value = profile.mode || 'pickup'; modeLabel.append(select); form.append(modeLabel);
  const submit = node('button', 'Enregistrer mon profil', 'primary'); submit.type = 'submit'; form.append(submit);
  form.addEventListener('submit', async event => {
    event.preventDefault(); submit.disabled = true;
    try {
      const data = { ...Object.fromEntries(new FormData(form)), favorites: profile.favorites || {} };
      const result = await accountApi('/profile', { method: 'PUT', body: data });
      profile = result.profile; renderAuth(); status.textContent = 'Profil enregistré.';
    } catch (error) { status.textContent = error.message; }
    finally { submit.disabled = false; }
  });
  content.append(form, caption('La disponibilité de la livraison et du ramassage est confirmée par chaque épicerie.'));
  content.append(node('h3', 'Mes succursales préférées'), caption(`${countLabel(Object.keys(profile.favorites || {}).length, 'succursale enregistrée', 'succursales enregistrées')}. Choisis-les dans une liste enregistrée.`));
  const actions = node('div', undefined, 'account-actions');
  actions.append(action('Effacer mes données enregistrées', () => {
    content.replaceChildren(node('h2', 'Effacer mon profil et mes listes ?'), caption('Cette action efface les listes et l’adresse dans ton compte. Ton accès de connexion et les copies sur cet appareil restent disponibles.'));
    const buttons = node('div', undefined, 'account-actions');
    buttons.append(action('Annuler', render, 'primary'), action('Effacer ces données', async () => {
      await accountApi('/data', { method: 'DELETE' }); await refresh(); status.textContent = 'Données du compte effacées.';
    }, 'danger')); content.append(buttons);
  }, 'danger'));
  content.append(actions);
}

window.addEventListener('hashchange', () => { status.textContent = ''; render(); document.querySelector('#account-main').focus({ preventScroll: true }); });
window.addEventListener('storage', event => { if (!signedIn() && event.key === SAVED_LISTS_KEY) void refresh(); });
// Local lists can render immediately while the optional account service loads.
lists = readSavedLists(localStorage); render();
document.querySelector('#account-identity').textContent = 'Listes sur cet appareil';
content.setAttribute('aria-busy', 'false');
try {
  clerk = await accountSession(); activeUser = clerk?.user?.id ?? null;
  clerk?.addListener(({ user }) => {
    const id = user?.id ?? null;
    if (id !== activeUser) { activeUser = id; lists = []; profile = {}; content.replaceChildren(); void refresh(); }
  });
} catch (error) { status.textContent = error.message; }
await refresh();
