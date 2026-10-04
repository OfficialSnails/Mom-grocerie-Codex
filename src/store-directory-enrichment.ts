// @ts-expect-error Shared browser geometry utilities.
import { distanceKm, locationKey, validCoordinates } from '../website/location-data.js';

export type Branch = { id: string; chainId: string; name: string; street: string; city: string;
  postalCode: string; lat: number; lon: number; source: string; verifiedAt: string;
  addressSource?: string; coordinateSource?: string; nearbyPlace?: { name: string; source: string } };
type Place = { name: string; lat: number; lon: number; source: string };
const streetKey = (street: string) => locationKey(street)
  .replace(/\b(?:boul|blv|bd)\b/g, 'boulevard').replace(/\b(?:ave|av)\b/g, 'avenue');

// Saved, source-backed observations only. Never fetch or geocode while shopping.
export function mergeLocatorRecords(branches: Branch[], records: Branch[], completeChains: string[] = []) {
  const result = branches.map(branch => ({ ...branch }));
  const observed = new Set<string>();
  for (const record of records) {
    if (!validCoordinates(record) || !record.id || !record.chainId || !record.name || !record.street || !record.city ||
        !/^https:\/\//.test(record.source) || !/^\d{4}-\d{2}-\d{2}$/.test(record.verifiedAt)) {
      throw new Error(`Incomplete official branch: ${record.id}; directory not changed.`);
    }
    const identity = result.find(branch => branch.chainId === record.chainId &&
      (branch.id === record.id || branch.addressSource === record.source || branch.source === record.source));
    let matches = (identity ? [identity] : result.filter(branch => branch.chainId === record.chainId && distanceKm(branch, record) < .25 &&
      // Two published store identities at different addresses may be neighbours.
      (!(branch.addressSource || !branch.source.includes('openstreetmap.org/')) || streetKey(branch.street) === streetKey(record.street))))
      .sort((a, b) => distanceKm(a, record) - distanceKm(b, record));
    if (matches.length > 1) {
      if (!matches.every(branch => streetKey(branch.street) === streetKey(record.street) &&
        (!branch.city || locationKey(branch.city) === locationKey(record.city)))) {
        if (!completeChains.includes(record.chainId)) throw new Error(`Ambiguous official branch: ${record.id}; review matching stores.`);
        // A complete official snapshot replaces ambiguous old map points with its own ID.
        matches = [];
      }
      // Duplicate map points at the same published address: keep the closest one.
      for (const duplicate of matches.slice(1)) result.splice(result.indexOf(duplicate), 1);
    }
    const match = matches[0];
    if (match) {
      // Stable IDs preserve shopper selections while refreshed source fields can change.
      Object.assign(match, {
        name: record.name, street: record.street, city: record.city, postalCode: record.postalCode,
        lat: record.lat, lon: record.lon, coordinateSource: record.coordinateSource ?? record.source,
        addressSource: record.source, verifiedAt: record.verifiedAt,
      });
      observed.add(match.id);
    } else { result.push({ ...record }); observed.add(record.id); }
  }
  return result.filter(branch => !completeChains.includes(branch.chainId) || observed.has(branch.id));
}

export function addNearbyPlace(branch: Branch, places: Place[]) {
  delete branch.nearbyPlace;
  if (branch.city || !validCoordinates(branch)) return branch;
  let closest: Place | undefined, distance = Infinity;
  for (const place of places) {
    const next = distanceKm(branch, place);
    if (next < distance) { closest = place; distance = next; }
  }
  // A nearby locality is useful context, not a verified municipal/street address.
  if (closest) branch.nearbyPlace = { name: closest.name, source: closest.source };
  return branch;
}

export function assertUniqueBranches(branches: Branch[]) {
  const ids = new Set();
  for (const branch of branches) {
    if (ids.has(branch.id)) throw new Error(`Duplicate branch ID: ${branch.id}`);
    ids.add(branch.id);
    if (!validCoordinates(branch)) throw new Error(`Invalid branch coordinates: ${branch.id}`);
    if (!locationKey(branch.name)) throw new Error(`Unnamed branch: ${branch.id}`);
  }
}
