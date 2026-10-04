export const locationKey = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\bst[ .-]/g, 'saint ').replace(/\bste[ .-]/g, 'sainte ').replace(/[^a-z0-9]+/g, ' ').trim();

export function validCoordinates(point) {
  return point && Number.isFinite(point.lat) && Number.isFinite(point.lon) && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180;
}
export function distanceKm(a, b) {
  if (!validCoordinates(a) || !validCoordinates(b)) return Infinity;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)));
}
export function nearestRegion(directory, location) {
  return Object.entries(directory.regionCenters ?? {}).map(([id, point]) => ({ id, distance: distanceKm(point, location) }))
    .filter(region => Number.isFinite(region.distance)).sort((a, b) => a.distance - b.distance)[0];
}
function oneTypo(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + (i < a.length || j < b.length ? 1 : 0) <= 1;
}
export function searchLocations(directory, query) {
  const key = locationKey(query), compact = key.replace(/ /g, '');
  if (compact.length < 2) return [];
  const words = key.split(' ');
  let places = (directory.places ?? []).filter(place => words.every(word => locationKey(`${place.name} ${(place.aliases ?? []).join(' ')}`).includes(word)))
    .map(place => ({ ...place, kind: 'town' }));
  if (!places.length && key.length >= 4) places = (directory.places ?? []).filter(place =>
    [place.name, ...(place.aliases ?? [])].some(name => oneTypo(locationKey(name), key))).map(place => ({ ...place, kind: 'town' }));
  const branches = (directory.branches ?? []).filter(branch => validCoordinates(branch) &&
    ((branch.postalCode && branch.postalCode.replace(/ /g, '').toLowerCase().startsWith(compact)) ||
    (/[0-9]/.test(key) && words.every(word => locationKey(`${branch.street} ${branch.city}`).includes(word)))))
    .map(branch => ({ ...branch, name: [branch.street, branch.city, branch.postalCode].filter(Boolean).join(', '), kind: 'address' }));
  return [...places, ...branches].sort((a, b) => Number(locationKey(b.name) === key) - Number(locationKey(a.name) === key) || (b.population ?? 0) - (a.population ?? 0) || a.name.localeCompare(b.name, 'fr')).slice(0, 12);
}
export function mapsUrl(name, address, branch) {
  // A coordinate-only query opens an unnamed pin, even for a known storefront.
  const destination = (branch?.street ? [branch.street, branch.city, branch.postalCode].filter(Boolean).join(', ') : address)
    || branch?.city;
  const localityOnly = !branch?.street && (!address || address === [branch?.city, branch?.postalCode].filter(Boolean).join(' '));
  if (validCoordinates(branch) && (localityOnly || (branch.street && !branch.city && !branch.postalCode))) {
    const label = [name, branch.street].filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/${encodeURIComponent(label)}/@${branch.lat},${branch.lon},16z`;
  }
  const query = [name, destination, 'Québec, Canada'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
export function locationError(error) {
  return error?.code === 1 ? 'Localisation refusée. Tu peux chercher une ville ci-dessous.'
    : error?.code === 3 ? 'La localisation prend trop de temps. Réessaie ou choisis une ville.'
    : 'Position indisponible. Tu peux chercher une ville ci-dessous.';
}

export function readDevicePosition(geolocation) {
  return new Promise((resolve, reject) => {
    if (!geolocation) { reject({ code: 2 }); return; }
    let finished = false;
    const finish = (callback, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      callback(value);
    };
    // Also bound the wait when the browser leaves its permission prompt pending.
    const timer = setTimeout(() => finish(reject, { code: 3 }), 20000);
    try {
      geolocation.getCurrentPosition(position => {
        const point = { lat: position.coords.latitude, lon: position.coords.longitude };
        if (!validCoordinates(point)) { finish(reject, { code: 2 }); return; }
        finish(resolve, { ...point, name: 'Ma position', source: 'device',
          capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null });
      }, error => finish(reject, error), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    } catch (error) { finish(reject, error); }
  });
}

export function branchDistanceLabel(distance, location) {
  if (!Number.isFinite(distance)) return '';
  return `À ${distance.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} km${location?.source === 'device' ? ' de toi' : ''}`;
}

export function locationCaption(location, centerName) {
  const origin = location?.source === 'device' ? 'ta position' : location?.name || centerName;
  return `Succursales autour de ${origin}`;
}
