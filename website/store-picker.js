import { availableBranches, branchAddress } from './store-directory.js';
import { mapsUrl, branchDistanceLabel } from './location-data.js';

const dialog = document.querySelector('#store-dialog');
const search = document.querySelector('#store-search');
const results = document.querySelector('#store-results');
let restoreFocus;
let renderResults;

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

export function openStorePicker({ directory, regionId, regionName, store, chosenId, choose, location }) {
  const trigger = document.activeElement;
  restoreFocus = () => (trigger?.isConnected ? trigger : document.querySelector(`[data-store-picker="${CSS.escape(store.id)}"]`))?.focus();
  document.querySelector('#store-dialog-title').textContent = store.name;
  document.querySelector('#store-dialog-region').textContent = `Succursales répertoriées à proximité · ${location?.name || regionName}`;
  search.value = '';
  renderResults = () => {
    const branches = availableBranches(directory, regionId, store.id, search.value, location);
    document.querySelector('#store-results-count').textContent = `${branches.length} succursale${branches.length === 1 ? '' : 's'}`;
    results.replaceChildren();
    if (!branches.length) {
      results.append(element('p', 'store-empty', 'Aucune succursale répertoriée pour cette recherche.'));
      return;
    }
    for (const branch of branches) {
      const row = element('div', 'branch-row', '');
      const info = element('div', 'branch-info', '');
      const address = element('a', '', branch.street ? branchAddress(branch) : 'Voir cette succursale sur Google Maps');
      address.href = mapsUrl(branch.name, branchAddress(branch), branch); address.target = '_blank'; address.rel = 'noopener noreferrer';
      info.append(element('strong', '', branch.name), address);
      if (Number.isFinite(branch.distance)) info.append(element('span', '', branchDistanceLabel(branch.distance, location)));
      const button = element('button', 'comparison-add', branch.id === chosenId ? 'Sélectionnée' : 'Choisir');
      button.type = 'button';
      button.setAttribute('aria-label', `Choisir ${branch.name}, ${branch.street || branch.city || 'sur la carte'}`);
      button.disabled = branch.id === chosenId;
      button.addEventListener('click', () => { choose(branch.id); dialog.close(); });
      row.append(info, button);
      results.append(row);
    }
    if (chosenId) {
      const reset = element('button', 'branch-reset', 'Utiliser la plus proche répertoriée');
      reset.type = 'button';
      reset.addEventListener('click', () => { choose(null); dialog.close(); });
      results.append(reset);
    }
  };
  renderResults();
  dialog.showModal();
  search.focus();
}

search.addEventListener('input', () => renderResults?.());
document.querySelector('#store-dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => restoreFocus?.());
