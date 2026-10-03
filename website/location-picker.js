import { searchLocations, nearestRegion, locationError, validCoordinates } from './location-data.js';

export function setupLocationPicker({ directory, regions, choose }) {
  const dialog = document.querySelector('#location-dialog');
  const search = dialog.querySelector('#location-search');
  const results = dialog.querySelector('#location-results');
  const status = dialog.querySelector('#location-status');
  const locate = dialog.querySelector('#location-use-device');
  const addressButton = dialog.querySelector('#location-address-search');
  let trigger, sequence = 0, busy = false;
  const say = text => { status.textContent = text; };
  async function select(place) {
    if (busy) return;
    const region = nearestRegion(directory, place);
    if (!region) { say('Aucune région disponible pour cette position.'); return; }
    // Coverage is currently Québec. Never silently map a distant country to its flyers.
    if (region.distance > 750) { say('Cette position est hors de la zone couverte. Choisis une ville au Québec.'); return; }
    busy = true;
    results.setAttribute('aria-busy', 'true');
    say('Chargement des circulaires…');
    try {
      await choose({ name: place.name, lat: place.lat, lon: place.lon, regionId: region.id });
      dialog.close();
    } catch (error) {
      console.error('Location selection failed:', error);
      say('Les circulaires sont indisponibles. Réessaie dans un instant.');
    } finally { busy = false; results.removeAttribute('aria-busy'); }
  }
  function show(places) {
    results.replaceChildren();
    for (const place of places) {
      if (!validCoordinates(place)) continue;
      const region = nearestRegion(directory, place);
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'location-result';
      const title = document.createElement('strong'); title.textContent = place.name;
      const caption = document.createElement('span');
      caption.textContent = `Circulaires : ${regions.find(entry => entry.id === region?.id)?.name ?? 'indisponibles'}`;
      button.append(title, caption); button.addEventListener('click', () => select(place)); results.append(button);
    }
  }
  search.addEventListener('input', () => {
    ++sequence;
    const found = searchLocations(directory, search.value);
    show(found);
    say(search.value.trim().length < 2 ? 'Entre au moins deux lettres.' : found.length ? `${found.length} résultat${found.length > 1 ? 's' : ''}` : 'Aucune ville trouvée. Essaie un autre nom ou utilise ta position.');
  });
  locate.addEventListener('click', () => {
    if (!navigator.geolocation) { say('Localisation indisponible dans ce navigateur. Choisis une ville.'); return; }
    const request = ++sequence;
    locate.disabled = true; say('Recherche de ta position…');
    navigator.geolocation.getCurrentPosition(position => {
      locate.disabled = false;
      if (request !== sequence || !dialog.open) return;
      const point = { lat: position.coords.latitude, lon: position.coords.longitude };
      select({ ...point, name: 'Ma position' });
    }, error => { locate.disabled = false; if (request === sequence && dialog.open) say(locationError(error)); },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  });
  addressButton.addEventListener('click', async () => {
    const query = search.value.trim();
    if (query.length < 3) { say('Entre une adresse ou un code postal.'); return; }
    const request = ++sequence;
    addressButton.disabled = true; say('Recherche de l’adresse…');
    try {
      const response = await fetch(`/api/location/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Recherche indisponible.');
      if (request !== sequence || !dialog.open) return;
      show(data.results);
      say(data.results.length ? `${data.results.length} adresse(s)` : 'Aucune adresse trouvée au Québec. Essaie une ville.');
    } catch (error) { if (request === sequence && dialog.open) say(error.message || 'Recherche indisponible. Essaie une ville.'); }
    finally { addressButton.disabled = false; }
  });
  dialog.querySelector('#location-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { ++sequence; trigger?.focus({ preventScroll: true }); });
  return {
    async open() {
      trigger = document.activeElement; search.value = ''; show([]); say('Choisis une ville ou utilise ta position.');
      dialog.showModal(); search.focus();
      // Optional server capability; static hosting still supports towns and GPS.
      addressButton.hidden = true;
      try {
        const response = await fetch('/api/location/config');
        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
          addressButton.hidden = !(await response.json()).addressSearch;
        }
      } catch (error) { console.info('Precise address lookup unavailable; town search remains available.'); }
    },
  };
}
