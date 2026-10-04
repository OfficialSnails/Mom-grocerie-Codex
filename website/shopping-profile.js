// Shared guest/account validation. Device preferences never contain authentication data.
export const DEVICE_PROFILE_KEY = 'bons-speciaux:shopping-profile:v1';
export const PROFILE_FIELDS = [
  ['name', 'Nom', 'name', 100], ['street', 'Adresse', 'address-line1', 200],
  ['apartment', 'Appartement', 'address-line2', 40], ['city', 'Ville', 'address-level2', 100],
  ['postalCode', 'Code postal', 'postal-code', 7],
];
export function normalizeProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Profil invalide.');
  const profile = {};
  for (const [key, , , max] of PROFILE_FIELDS) {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > max) throw new Error('Champ invalide ou trop long.');
    profile[key] = value.trim();
  }
  profile.postalCode = profile.postalCode.replace(/\s/g, '').toUpperCase();
  if (profile.postalCode && !/^[GHJ][0-9][A-Z][0-9][A-Z][0-9]$/.test(profile.postalCode)) throw new Error('Entre un code postal du Québec valide.');
  profile.mode = input.mode ?? 'pickup';
  if (!['pickup', 'delivery', 'in_store'].includes(profile.mode)) throw new Error('Mode de courses invalide.');
  profile.province = 'QC'; profile.country = 'CA'; profile.favorites = {};
  if (input.favorites !== undefined) {
    if (!input.favorites || typeof input.favorites !== 'object' || Array.isArray(input.favorites) || Object.keys(input.favorites).length > 30) throw new Error('Succursales invalides.');
    for (const [chain, branch] of Object.entries(input.favorites)) {
      if (!/^[a-z0-9-]{1,80}$/.test(chain) || typeof branch !== 'string' || !/^[a-zA-Z0-9:_-]{1,180}$/.test(branch)) throw new Error('Succursale invalide.');
      Object.defineProperty(profile.favorites, chain, { value: branch, enumerable: true });
    }
  }
  return profile;
}
export function readDeviceProfile(storage) {
  let raw;
  try { raw = storage.getItem(DEVICE_PROFILE_KEY); }
  catch { throw new Error('Le navigateur bloque l’accès aux préférences.'); }
  if (raw === null) return normalizeProfile({});
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1) throw new Error('Version inconnue.');
    return normalizeProfile(data.profile);
  } catch { throw new Error('Les préférences de cet appareil sont illisibles. Elles ont été conservées.'); }
}
export function saveDeviceProfile(storage, input) {
  const profile = normalizeProfile(input);
  try { storage.setItem(DEVICE_PROFILE_KEY, JSON.stringify({ version: 1, profile })); }
  catch { throw new Error('Préférences non enregistrées. Vérifie l’espace et les réglages du navigateur.'); }
  return profile;
}
export function clearDeviceProfile(storage) {
  try { storage.removeItem(DEVICE_PROFILE_KEY); }
  catch { throw new Error('Impossible d’effacer les préférences de cet appareil.'); }
}
