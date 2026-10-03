import { pageTiles } from './flyer-pages.js';
let flyers = [];
let request = 0;
const dialog = document.querySelector('#flyers-dialog');
const grid = document.querySelector('#flyers-grid');
const reader = document.querySelector('#flyer-reader');
const toggle = document.querySelector('#flyers-toggle');
const close = document.querySelector('#flyers-close');
const heading = document.querySelector('#flyers-title');
let lastSourceButton;

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}
function showGrid() {
  reader.hidden = true;
  reader.replaceChildren();
  grid.hidden = false;
  heading.textContent = 'Circulaires';
  lastSourceButton?.focus();
}
function showFlyer(flyer, button) {
  lastSourceButton = button;
  grid.hidden = true;
  reader.hidden = false;
  reader.replaceChildren();
  heading.textContent = flyer.storeName;
  const back = element('button', 'nav-link flyer-back', '← Toutes les circulaires');
  back.type = 'button';
  back.addEventListener('click', showGrid);
  reader.append(back);
  const pages = flyer.pages ?? [];
  if (!pages.length) {
    reader.append(element('p', 'flyer-message', 'Les pages de cette circulaire ne sont plus disponibles ici.'));
  } else {
    const period = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long', timeZone: 'America/Toronto' });
    reader.append(element('p', 'flyer-period', `${period.format(new Date(flyer.startsAt))} au ${period.format(new Date(flyer.endsAt))} · ${pages.length} pages`));
    for (const [index, page] of pages.entries()) {
      const figure = element('figure', 'flyer-page');
      const surface = element('div', 'flyer-page-image');
      surface.style.aspectRatio = `${page.right - page.left} / ${page.top - page.bottom}`;
      surface.setAttribute('role', 'img');
      surface.setAttribute('aria-label', `Circulaire ${flyer.storeName}, page ${index + 1}`);
      let failed = false;
      for (const tile of pageTiles(flyer, page)) {
        const img = document.createElement('img');
        img.src = tile.url;
        img.alt = '';
        img.loading = index === 0 ? 'eager' : 'lazy';
        img.decoding = 'async';
        Object.assign(img.style, { left: `${tile.left}%`, top: `${tile.top}%`, width: `${tile.width}%`, height: `${tile.height}%` });
        img.addEventListener('error', () => {
          if (failed) return;
          failed = true;
          surface.replaceChildren(element('p', 'flyer-message', `Page ${index + 1} indisponible. Consulte la source ci-dessous.`));
        });
        surface.append(img);
      }
      figure.append(surface, element('figcaption', '', `Page ${index + 1} / ${pages.length}`));
      reader.append(figure);
    }
  }
  const source = element('a', 'flyer-source', `Source : ${flyer.storeName} · Flipp`);
  source.href = flyer.url;
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  reader.append(source);
  back.focus();
  dialog.scrollTop = 0;
}

export async function loadFlyers(week) {
  const current = ++request;
  flyers = [];
  showGrid();
  grid.textContent = 'Chargement des circulaires…';
  document.querySelector('#flyers-week').textContent = week.weekRange;
  try {
    const response = await fetch(`${week.dataPath ?? `data/weeks/${encodeURIComponent(week.slug)}/`}flyers.json`);
    if (!response.ok) throw new Error(`Circulaires : HTTP ${response.status}`);
    const data = await response.json();
    if (current !== request) return;
    flyers = data.flyers;
    grid.replaceChildren();
    for (const flyer of flyers) {
      const button = element('button', 'flyer-card');
      button.type = 'button';
      button.setAttribute('aria-label', `Consulter la circulaire ${flyer.storeName}`);
      const preview = element('div', 'flyer-preview');
      if (flyer.cover) {
        const img = document.createElement('img');
        img.src = flyer.cover;
        img.alt = '';
        img.loading = 'lazy';
        img.addEventListener('error', () => preview.replaceChildren(element('span', '', flyer.storeName)));
        preview.append(img);
      } else preview.textContent = flyer.storeName;
      button.append(preview, element('h3', '', flyer.storeName), element('span', 'flyer-action', flyer.pages?.length ? `${flyer.pages.length} pages →` : 'Consulter →'));
      button.addEventListener('click', () => showFlyer(flyer, button));
      grid.append(button);
    }
    if (!flyers.length) grid.textContent = 'Aucune circulaire disponible pour cette semaine.';
  } catch (error) {
    if (current !== request) return;
    grid.textContent = 'Les circulaires sont indisponibles. Les produits restent accessibles.';
    console.error(error);
  }
}

toggle.addEventListener('click', () => { showGrid(); dialog.showModal(); });
close.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => toggle.focus());
