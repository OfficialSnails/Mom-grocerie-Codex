let pending;
const appearance = { variables: { colorPrimary: '#2d4739', colorBackground: '#fffefa',
  colorText: '#171714', borderRadius: '12px', fontFamily: 'Inter, system-ui, sans-serif' } };

function script(url, key) {
  return new Promise((resolve, reject) => {
    const element = document.createElement('script');
    element.src = url;
    element.crossOrigin = 'anonymous';
    if (key) element.dataset.clerkPublishableKey = key;
    element.onload = resolve;
    element.onerror = () => { element.remove(); reject(new Error('La connexion est indisponible. Réessaie.')); };
    document.head.append(element);
  });
}

export function accountSession() {
  if (!pending) pending = (async () => {
    const response = await fetch('/api/account/config', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Le service de connexion ne répond pas.');
    const config = await response.json();
    if (!config.enabled) return null;
    const domain = atob(config.publishableKey.split('_')[2]).replace(/\$$/, '');
    if (!/^[a-z0-9.-]+$/i.test(domain)) throw new Error('Configuration de connexion invalide.');
    await script(`https://${domain}/npm/@clerk/ui@1/dist/ui.browser.js`);
    await script(`https://${domain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, config.publishableKey);
    await window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor }, appearance, localization: config.localization });
    return window.Clerk;
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}

export async function accountApi(path, { method = 'GET', body } = {}) {
  const clerk = await accountSession();
  if (!clerk?.user) throw new Error('Connecte-toi pour enregistrer dans ton compte.');
  const token = await clerk.session.getToken();
  if (!token) throw new Error('Session expirée. Reconnecte-toi.');
  const response = await fetch(`/api/account${path}`, { method, cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Action indisponible. Réessaie.');
  return data;
}

export async function saveToAccount(snapshot, importOnly = false) {
  return accountApi('/lists', { method: 'PUT', body: { snapshot, importOnly } });
}

export function openListPage(id = '', device = false) {
  const url = new URL('./account.html', location.href);
  if (device) url.searchParams.set('device', '1');
  if (id) url.hash = `list=${encodeURIComponent(id)}`;
  location.assign(url);
}

export async function setupAccountButton(button, onChange, onError) {
  if (!button) return;
  try {
    const clerk = await accountSession();
    if (!clerk) { await onChange?.(null); return; }
    let owner;
    clerk.addListener(({ user }) => {
      button.dataset.connected = String(Boolean(user));
      button.setAttribute('aria-label', user ? 'Mon espace, connecté' : 'Mon espace sur cet appareil');
      button.removeAttribute('aria-haspopup');
      const next = user?.id ?? null;
      if (next !== owner) { owner = next; Promise.resolve(onChange?.(next)).catch(onError); }
    });
  } catch (error) { onError(error); }
}
