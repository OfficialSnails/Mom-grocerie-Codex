// Keep the native select as the value/change source; contain its menu in the page.
export function enhanceDropdown(select) {
  const root = document.createElement('div');
  root.className = 'dropdown';
  const label = select.labels?.[0];
  const name = select.getAttribute('aria-label') || label?.textContent || '';
  const button = document.createElement('button');
  button.type = 'button';
  button.id = `${select.id}-toggle`;
  button.className = 'dropdown-toggle';
  button.setAttribute('role', 'combobox');
  button.setAttribute('aria-label', name);
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  const text = document.createElement('span');
  text.className = 'dropdown-label';
  const icon = document.createElement('span');
  icon.className = 'disclosure-icon';
  icon.setAttribute('aria-hidden', 'true');
  button.append(text, icon);
  const menu = document.createElement('div');
  menu.id = `${select.id}-options`;
  menu.className = 'dropdown-options';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', name);
  menu.hidden = true;
  button.setAttribute('aria-controls', menu.id);
  select.before(root);
  root.append(select, button, menu);
  select.hidden = true;
  if (label) label.htmlFor = button.id;
  const controller = new AbortController();
  let active = -1;
  let typed = '';
  let typedAt = 0;

  function positionMenu() {
    if (menu.hidden) return;
    const field = button.getBoundingClientRect();
    const dialog = root.closest('dialog');
    const bounds = dialog?.getBoundingClientRect();
    const heading = dialog?.querySelector('.comparison-heading')?.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = Math.max((viewport?.offsetTop ?? 0) + 8, bounds ? bounds.top + 8 : 0, heading ? heading.bottom + 8 : 0);
    const bottom = Math.min((viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 8, bounds ? bounds.bottom - 8 : Infinity);
    // A scrolled-out field must not leave its menu floating over the dialog.
    if (field.bottom <= top || field.top >= bottom) { close(); return; }
    const below = Math.max(0, bottom - field.bottom - 6);
    const above = Math.max(0, field.top - top - 6);
    const preferred = Math.min(260, (viewport?.height ?? window.innerHeight) * .35, menu.scrollHeight + 2);
    const upward = below < preferred && above > below;
    menu.style.maxHeight = `${Math.floor(Math.min(preferred, upward ? above : below))}px`;
    menu.style.top = upward ? 'auto' : 'calc(100% + 6px)';
    menu.style.bottom = upward ? 'calc(100% + 6px)' : 'auto';
  }

  function highlight(index) {
    active = index;
    [...menu.children].forEach((option, i) => option.classList.toggle('active', i === index));
    const option = menu.children[index];
    if (option) {
      button.setAttribute('aria-activedescendant', option.id);
      // Scroll only the list, never the page or the containing dialog.
      const offset = option.getBoundingClientRect().top - menu.getBoundingClientRect().top;
      if (offset < 0) menu.scrollTop += offset;
      else if (offset + option.offsetHeight > menu.clientHeight) menu.scrollTop += offset + option.offsetHeight - menu.clientHeight;
    }
  }

  function close() {
    menu.hidden = true;
    root.removeAttribute('data-open');
    button.setAttribute('aria-expanded', 'false');
    button.removeAttribute('aria-activedescendant');
    typed = '';
  }

  function open() {
    if (button.disabled) return;
    menu.hidden = false;
    root.setAttribute('data-open', '');
    button.setAttribute('aria-expanded', 'true');
    positionMenu();
    if (menu.hidden) return;
    highlight(Math.max(0, select.selectedIndex));
  }

  function choose(index) {
    if (!select.options[index]) return;
    const changed = select.selectedIndex !== index;
    select.selectedIndex = index;
    sync();
    close();
    if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function sync() {
    close();
    menu.replaceChildren();
    text.textContent = select.selectedOptions[0]?.textContent || 'Aucun résultat';
    button.disabled = select.disabled || !select.options.length;
    [...select.options].forEach((option, index) => {
      const row = document.createElement('div');
      row.id = `${menu.id}-${index}`;
      row.className = 'dropdown-option';
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(option.selected));
      row.textContent = option.textContent;
      row.addEventListener('click', () => { choose(index); button.focus({ preventScroll: true }); });
      menu.append(row);
    });
  }

  button.addEventListener('click', () => menu.hidden ? open() : close());
  menu.addEventListener('mousedown', event => event.preventDefault());
  root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) close(); });
  document.addEventListener('pointerdown', event => { if (!root.contains(event.target)) close(); }, { signal: controller.signal });
  document.addEventListener('scroll', event => { if (event.target !== menu) positionMenu(); }, { capture: true, signal: controller.signal });
  window.addEventListener('resize', positionMenu, { signal: controller.signal });
  window.visualViewport?.addEventListener('resize', positionMenu, { signal: controller.signal });
  window.visualViewport?.addEventListener('scroll', positionMenu, { signal: controller.signal });
  button.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === 'Tab') { if (!menu.hidden) choose(active); return; }
    if (['Enter', ' '].includes(event.key)) {
      event.preventDefault(); menu.hidden ? open() : choose(active); return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (menu.hidden) { open(); return; }
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? select.options.length - 1 : active + (event.key === 'ArrowDown' ? 1 : -1);
      highlight(Math.max(0, Math.min(select.options.length - 1, index)));
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (menu.hidden) open();
      typed = Date.now() - typedAt > 700 ? event.key : typed + event.key;
      typedAt = Date.now();
      const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const index = [...select.options].findIndex(option => normalize(option.textContent).startsWith(normalize(typed)));
      if (index >= 0) highlight(index);
    }
  });
  select.addEventListener('change', sync, { signal: controller.signal });
  sync();
  return { sync, close, destroy: () => { close(); controller.abort(); } };
}
