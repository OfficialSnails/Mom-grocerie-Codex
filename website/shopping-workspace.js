export function setupShoppingWorkspace() {
  const button = document.querySelector('#basket-toggle');
  const panel = document.querySelector('#basket-panel');
  const close = document.querySelector('#basket-close');
  const mobile = window.matchMedia('(max-width: 900px)');
  const background = [...document.querySelectorAll('body > :not(#basket-panel):not(script):not(.image-preview)')];
  const closeBasket = () => {
    document.body.classList.remove('basket-open');
    panel.removeAttribute('role');
    panel.removeAttribute('aria-modal');
    document.querySelectorAll('[data-basket-inert]').forEach(el => { el.inert = false; el.removeAttribute('data-basket-inert'); });
    button.setAttribute('aria-expanded', 'false');
  };
  button.addEventListener('click', () => {
    if (!mobile.matches) { panel.focus(); return; }
    document.body.classList.add('basket-open');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    button.setAttribute('aria-expanded', 'true');
    for (const el of [...background, ...document.querySelectorAll('.layout > :not(.selection-panel)')]) {
      if (el.contains(panel) || ['TEMPLATE', 'DIALOG'].includes(el.tagName)) continue;
      el.inert = true;
      el.setAttribute('data-basket-inert', '');
    }
    close.focus();
  });
  close.addEventListener('click', () => { closeBasket(); button.focus(); });
  document.addEventListener('keydown', event => {
    if (!document.body.classList.contains('basket-open')) return;
    if (document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape') { closeBasket(); button.focus(); }
    if (event.key === 'Tab') {
      const controls = [...panel.querySelectorAll('button:not(:disabled), textarea, a[href], input')].filter(el => el.offsetParent !== null);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  const resize = () => {
    closeBasket();
    document.querySelectorAll('.filter-disclosure').forEach(details => { details.open = !mobile.matches; });
  };
  mobile.addEventListener('change', resize);
  resize();
}
