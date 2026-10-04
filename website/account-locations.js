import { setupLocationPicker } from './location-picker.js';
import { openStorePicker } from './store-picker.js';
import { branchLocationLabel, compactStoreAddress } from './store-directory.js';
import { mapsUrl, validCoordinates, distanceKm, branchDistanceLabel } from './location-data.js';
import { changeListBranch, relocateList } from './saved-lists.js';

export const LOCATION_KEY = 'bons-speciaux:location';
const element = (tag, text, className = '') => {
  const node = document.createElement(tag); node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function setupAccountLocations({ getList, persist, changed, report }) {
  let directory = {}, regions = [], origin = null, loading, picker, activeListId;
  function readOrigin() {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCATION_KEY) || 'null');
      origin = validCoordinates(saved) ? saved : null;
    } catch { origin = null; report('La position enregistrée est illisible. Choisis à nouveau ta position.'); }
  }
  readOrigin();
  async function ready() {
    if (loading) return loading;
    loading = (async () => {
      const load = async path => {
        const response = await fetch(path, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Le répertoire des succursales est indisponible. Réessaie.');
        return response.json();
      };
      const [locations, registry] = await Promise.all([load('./data/store-locations.json'), load('./data/regions.json')]);
      directory = locations; regions = registry.regions;
      picker = setupLocationPicker({ directory, regions, purpose: 'branches', choose: async position => {
        const current = getList(activeListId);
        if (!current) throw new Error('Cette liste n’est plus disponible.');
        await persist(relocateList(current, directory, position));
        try {
          localStorage.setItem('bons-speciaux:region', position.regionId);
          localStorage.removeItem(`bons-speciaux:branches:${position.regionId}`);
          localStorage.setItem(LOCATION_KEY, JSON.stringify(position));
        } catch {
          changed();
          throw new Error('Les succursales sont enregistrées, mais le navigateur n’a pas pu conserver ta position.');
        }
        origin = position; changed();
        report('Position mise à jour.');
      } });
    })().catch(error => { loading = null; throw error; });
    return loading;
  }
  function button(label, callback, className = '') {
    const control = element('button', label, className); control.type = 'button';
    control.addEventListener('click', async () => {
      control.disabled = true;
      try { await callback(control); } catch (error) { report(error.message || 'Action indisponible. Réessaie.'); }
      finally { control.disabled = false; }
    }); return control;
  }
  function positionControl(snapshot) {
    const block = element('div', undefined, 'account-position');
    block.append(element('p', origin?.name || directory.regionCenters?.[snapshot.regionId]?.name || snapshot.week.regionName, 'account-caption'));
    const change = button(origin ? 'Changer ma position' : 'Me localiser', async control => {
      await ready(); activeListId = snapshot.id; await picker.open(control);
    });
    change.id = 'location-edit'; change.setAttribute('aria-haspopup', 'dialog');
    block.append(change); return block;
  }
  function storeHeader(snapshot, store) {
    const header = element('header', undefined, 'account-store-banner');
    const identity = element('div', undefined, 'store-banner-identity');
    identity.append(element('h3', store.name));
    const distance = distanceKm(origin || directory.regionCenters?.[snapshot.regionId], store.branch);
    if (Number.isFinite(distance)) identity.append(element('span', branchDistanceLabel(distance, origin), 'store-distance'));
    const destination = element('div', undefined, 'store-banner-destination');
    const label = compactStoreAddress(store.address) || branchLocationLabel(store.branch);
    if (label) {
      const address = element('a', label, 'store-address');
      address.href = mapsUrl(store.name, store.address, store.branch);
      address.target = '_blank'; address.rel = 'noopener noreferrer';
      address.setAttribute('aria-label', `Ouvrir ${store.name}, ${store.address || label} dans Google Maps`);
      destination.append(address);
    } else destination.append(element('span', 'Succursale à choisir', 'store-address'));
    const actions = element('div', undefined, 'account-store-address-actions');
    const edit = button(store.branch || store.address ? 'Modifier' : 'Choisir', async control => {
      await ready();
      openStorePicker({ directory, regionId: snapshot.regionId, regionName: snapshot.week.regionName,
        store, chosenId: store.branch?.id, location: origin, trigger: control, choose: async id => {
          const current = getList(snapshot.id);
          if (!current) throw new Error('Cette liste n’est plus disponible.');
          await persist(changeListBranch(current, store.id, id, directory, origin));
          changed(); report('Succursale modifiée.');
        } });
    }, 'account-address-action');
    edit.dataset.storePicker = store.id;
    edit.setAttribute('aria-label', `Changer de succursale pour ${store.name}`);
    edit.setAttribute('aria-haspopup', 'dialog'); actions.append(edit);
    header.append(identity, destination, actions); return header;
  }
  return { ready, positionControl, storeHeader, reloadOrigin() { readOrigin(); changed(); } };
}
