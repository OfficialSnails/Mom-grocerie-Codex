import { distanceKm, validCoordinates, locationKey } from './location-data.js';
const normalized = value => locationKey(value).replace(/ /g, '');
const chainId = storeId => storeId.replace(/-(joliette|montreal|quebec)$/, '');

export function availableBranches(directory, regionId, storeId, query = '', location) {
  const search = normalized(query);
  const origin = validCoordinates(location) ? location : directory.regionCenters?.[regionId];
  return (directory.branches ?? []).flatMap(branch => {
    const compatible = branch.chainId ? branch.chainId === chainId(storeId) : branch.regionId === regionId && branch.storeId === storeId;
    if (!compatible || (search && !normalized(`${branch.name} ${branch.street} ${branch.city} ${branch.postalCode}`).includes(search))) return [];
    const distance = distanceKm(origin, branch);
    return branch.chainId && distance > 50 ? [] : [{ ...branch, distance }];
  })
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name, 'fr'));
}

export function selectedBranch(directory, regionId, storeId, choices = {}, location) {
  return availableBranches(directory, regionId, storeId, '', location).find(branch => branch.id === choices[storeId]);
}
export function activeBranch(directory, regionId, storeId, choices = {}, location) {
  const branches = availableBranches(directory, regionId, storeId, '', location);
  return branches.find(branch => branch.id === choices[storeId]) ?? branches.find(branch => Number.isFinite(branch.distance));
}

export function branchAddress(branch) {
  return [branch.street, [branch.city, branch.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

// The same verified lookup is used by the basket, browser PDF and local PDF.
// A branch from a different store or region is never accepted as an override.
export function storeAddress(item, directory, regionId, choices = {}, location) {
  const branch = activeBranch(directory, regionId, item.storeId, choices, location);
  if (branch) return branch.street ? branchAddress(branch) : '';
  if (validCoordinates(location)) return '';
  const fallbackLocation = regionId === 'joliette' ? directory.stores?.[item.storeId] : null;
  return fallbackLocation ? fallbackLocation.address ?? '' : item.storeAddress ?? '';
}
