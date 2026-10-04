import { money, productTitle, loyaltyLabel } from './product-details.js';
import { readSavedLists, saveList, removeSavedList, setListArchived, savedListTotals } from './saved-lists.js';

function node(tag, className, text) {
  const result = document.createElement(tag);
  result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const itemsIn = snapshot => snapshot.stores.flatMap(store => store.items);

export function setupListDialog({ exportCurrent, exportSaved, status }) {
  const dialog = document.querySelector('#list-dialog');
  const title = document.querySelector('#list-dialog-title');
  const content = document.querySelector('#list-dialog-content');
  const message = document.querySelector('#list-dialog-status');
  const close = document.querySelector('#list-dialog-close');
  let trigger;
  let showArchived = false;

  function view(heading, mode = 'detail') {
    dialog.dataset.view = mode;
    title.textContent = heading;
    content.replaceChildren();
    message.textContent = '';
    dialog.scrollTop = 0;
    if (!dialog.open) {
      trigger = document.activeElement;
      dialog.showModal();
    }
    close.focus();
  }

  function action(label, callback, className = 'list-action') {
    const button = node('button', className, label);
    button.type = 'button';
    button.addEventListener('click', async () => {
      button.disabled = true;
      message.textContent = '';
      try { await callback(); }
      catch (error) { message.textContent = error.message || 'Cette action a échoué. Réessaie.'; }
      finally { button.disabled = false; }
    });
    return button;
  }

  function metric(label, value, className = '') {
    const block = node('div', `list-metric ${className}`);
    block.append(node('span', '', label), node('strong', '', value));
    return block;
  }

  function overview(snapshot, savingsOnly = false) {
    const metrics = node('div', 'list-metrics');
    if (savingsOnly) metrics.classList.add('savings-only');
    metrics.append(metric('Économies estimées', money(snapshot.savings.amount), 'savings'));
    if (!savingsOnly) metrics.append(metric('Total estimé', money(snapshot.estimate.subtotal)));
    content.append(metrics);
    if (!savingsOnly && (snapshot.estimate.variableCount || snapshot.estimate.unknownCount)) {
      content.append(node('p', 'list-caption', [
        snapshot.estimate.variableCount ? `${snapshot.estimate.variableCount} prix au poids hors total` : '',
        snapshot.estimate.unknownCount ? `${snapshot.estimate.unknownCount} prix à vérifier` : '',
      ].filter(Boolean).join(' · ')));
    }
  }

  function line(parent, label, value) {
    parent.append(node('dt', '', label), node('dd', '', value));
  }

  function productDetail(item, saving, difference, store, expanded) {
    if (!saving?.amount && !difference?.amount) {
      const row = node('div', 'saved-list-row');
      row.append(node('strong', '', productTitle(item.name)), node('small', '', `${store.name} · ${item.price}`));
      return row;
    }
    const detail = node('details', 'savings-item');
    detail.open = expanded;
    const summary = node('summary', '');
    const label = node('span', 'savings-item-label');
    label.append(node('strong', '', productTitle(item.name)), node('small', '', `${store.name} · ${item.price}`));
    summary.append(label, node('span', 'savings-item-value', saving ? `${money(saving.amount)}${saving.unit} de moins` : `Écart ${money(difference.amount)}`));
    const chevron = node('span', 'disclosure-icon');
    chevron.setAttribute('aria-hidden', 'true');
    summary.append(chevron);
    detail.append(summary);
    const body = node('div', 'savings-item-detail');
    const prices = node('dl', 'savings-prices');
    line(prices, `Votre prix · ${store.name}`, item.price);
    if (saving) {
      line(prices, saving.kind === 'regular' ? `Prix régulier · ${saving.store}` : `Chez ${saving.store}${saving.normalized ? ` · pour ${saving.quantityLabel}` : ''}`, `${money(saving.reference)}${saving.unit}`);
      line(prices, saving.canTotal ? 'Économie' : 'Économie par unité', `${money(saving.amount)}${saving.unit}`);
    }
    if (difference) {
      line(prices, `Chez ${difference.store}`, money(difference.reference));
      line(prices, 'Écart de prix affiché', money(difference.amount));
    }
    body.append(prices);
    if (saving?.normalized) body.append(node('p', 'list-caption', `${saving.referenceFormat} à ${money(saving.referencePrice)} chez ${saving.store}. Comparaison pour ${saving.quantityLabel}.`));
    if (item.offerEvidence?.formatLabel) body.append(node('p', 'list-caption', item.offerEvidence.formatLabel));
    if (loyaltyLabel(item)) body.append(node('p', 'list-caption', loyaltyLabel(item)));
    if (saving?.referenceCondition) body.append(node('p', 'list-caption', `${saving.store} : ${saving.referenceCondition}`));
    if (saving && !saving.canTotal) body.append(node('p', 'list-caption', 'Hors économies de la liste : le montant dépend de la quantité.'));
    if (difference) body.append(node('p', 'list-caption', `${difference.currentFormat} contre ${difference.referenceFormat}. Écart hors économies de la liste.`));
    detail.append(body);
    return detail;
  }

  function details(snapshot, itemId, savingsOnly = false) {
    const entries = new Map(snapshot.savings.entries.map(entry => [entry.id, entry.saving]));
    const differences = new Map(snapshot.savings.entries.map(entry => [entry.id, entry.difference]));
    for (const store of snapshot.stores) {
      for (const item of store.items) {
        if (itemId && item.id !== itemId) continue;
        if (savingsOnly && !(entries.get(item.id)?.amount > 0)) continue;
        content.append(productDetail(item, entries.get(item.id), differences.get(item.id), store, !savingsOnly && Boolean(itemId)));
      }
    }
  }

  function showSavings(snapshot, itemId) {
    view(itemId ? 'Détail du produit' : 'Économies sur la liste');
    content.append(node('p', 'list-caption list-context', `${snapshot.week.regionName} · ${snapshot.week.weekRange}`));
    if (!itemId) overview(snapshot, true);
    details(snapshot, itemId, true);
  }

  function showSaved(snapshot) {
    view(snapshot.week.weekRange);
    content.append(action('Toutes mes listes', showHistory, 'list-text-action'));
    content.append(node('p', 'list-caption list-context', `${snapshot.week.regionName} · Enregistrée le ${new Date(snapshot.savedAt).toLocaleDateString('fr-CA')}`));
    overview(snapshot);
    details(snapshot);
    if (snapshot.notes) {
      content.append(node('h3', 'list-section-title', 'Notes'), node('p', 'list-notes', snapshot.notes));
    }
    const actions = node('div', 'list-dialog-actions');
    actions.append(action('Télécharger le PDF', async () => {
      await exportSaved(snapshot);
      message.textContent = 'Téléchargement du PDF demandé.';
    }, 'list-action primary'), action(snapshot.archivedAt ? 'Restaurer la liste' : 'Archiver la liste', () => {
      setListArchived(localStorage, snapshot.id, !snapshot.archivedAt);
      showHistory();
    }), action('Supprimer cette liste', () => confirmRemove(snapshot), 'list-text-action danger'));
    content.append(actions);
  }

  function confirmRemove(snapshot) {
    view('Supprimer cette liste?');
    content.append(node('p', 'list-context', `${snapshot.week.regionName} · ${snapshot.week.weekRange}`));
    const actions = node('div', 'list-dialog-actions');
    actions.append(action('Garder la liste', () => showSaved(snapshot), 'list-action primary'), action('Supprimer', () => {
      removeSavedList(localStorage, snapshot.id);
      showHistory();
    }, 'list-action danger'));
    content.append(actions);
  }

  function showHistory() {
    view('Mes listes', 'history');
    content.append(node('p', 'list-caption list-context', 'Sur cet appareil · Une liste par semaine et par région.'));
    let lists;
    try { lists = readSavedLists(localStorage); }
    catch (error) { message.textContent = error.message; return; }
    const tabs = node('div', 'saved-list-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Afficher les listes');
    for (const [archived, label] of [[false, 'Mes listes'], [true, 'Archives']]) {
      const count = lists.filter(list => Boolean(list.archivedAt) === archived).length;
      const button = action(`${label} (${count})`, () => { showArchived = archived; showHistory(); });
      button.setAttribute('aria-pressed', String(showArchived === archived));
      tabs.append(button);
    }
    content.append(tabs);
    lists = lists.filter(list => Boolean(list.archivedAt) === showArchived);
    if (!lists.length) {
      content.append(node('p', 'list-empty', showArchived ? 'Aucune liste archivée.' : 'Aucune liste dans cette section.'));
      if (!showArchived) content.append(action('Préparer ma liste', () => dialog.close(), 'list-action primary'));
      return;
    }
    const totals = savedListTotals(lists);
    const metrics = node('div', 'list-metrics');
    metrics.append(metric('Économies estimées', money(totals.savings), 'savings'), metric(showArchived ? 'Listes archivées' : 'Listes enregistrées', String(totals.count)));
    content.append(metrics);
    content.append(node('p', 'list-caption', 'Prix et comparaisons conservés au moment de l’enregistrement.'));
    const list = node('div', 'saved-list-rows');
    for (const snapshot of lists) {
      const row = node('div', 'saved-list-entry');
      const button = action('', () => showSaved(snapshot), 'saved-list-row');
      const label = node('span', 'saved-list-label');
      label.append(node('strong', '', snapshot.week.weekRange),
        node('small', '', `${snapshot.week.regionName} · ${plural(itemsIn(snapshot).length, 'produit')}`));
      const amounts = node('span', 'saved-list-amounts');
      amounts.append(node('strong', '', money(snapshot.estimate.subtotal)),
        node('small', '', `${money(snapshot.savings.amount)} d’économies`));
      button.append(label, amounts);
      const archive = action(showArchived ? 'Restaurer' : 'Archiver', () => {
        setListArchived(localStorage, snapshot.id, !showArchived);
        showHistory();
      }, 'list-action saved-list-archive');
      archive.setAttribute('aria-label', `${showArchived ? 'Restaurer' : 'Archiver'} la liste du ${snapshot.week.weekRange} · ${snapshot.week.regionName}`);
      row.append(button, archive);
      list.append(row);
    }
    content.append(list);
    content.append(node('p', 'list-caption', 'Sans compte, ces listes restent dans ce navigateur.'));
  }

  function saveCurrent(snapshot) {
    try {
      saveList(localStorage, snapshot);
      status('Liste enregistrée dans Mes listes.', 'success', 'Sur cet appareil.');
      return true;
    } catch (error) { status(error.message, 'warning'); return false; }
  }

  function showExport(snapshot) {
    view('Exporter ma liste');
    content.append(node('p', 'list-context', `${snapshot.week.regionName} · ${snapshot.week.weekRange}`));
    overview(snapshot);
    content.append(node('p', 'list-caption', 'Enregistrer conserve cette semaine dans Mes listes, sur cet appareil. Un nouvel enregistrement met cette liste à jour.'));
    const actions = node('div', 'list-dialog-actions export-choices');
    actions.append(action('Enregistrer et exporter', async () => {
      saveList(localStorage, snapshot);
      dialog.close();
      await exportCurrent();
    }, 'list-action primary'), action('Exporter seulement', async () => {
      dialog.close();
      await exportCurrent();
    }), action('Enregistrer seulement', () => {
      saveList(localStorage, snapshot);
      dialog.close();
      status('Liste enregistrée dans Mes listes.', 'success', 'Sur cet appareil.');
    }, 'list-text-action'));
    content.append(actions);
  }

  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { if (trigger?.isConnected) trigger.focus(); });
  document.querySelector('#history-toggle').addEventListener('click', showHistory);
  return { showSavings, showHistory, showExport, saveCurrent };
}
