import { pageTiles } from './flyer-pages.js';

// Render the original flyer pixels, with the source-associated offer bounds.
// Keep the supplied cutout if optional page images cannot be loaded.
export function mountProofImage(container, item, className = 'proof') {
  const original = document.createElement('img');
  original.className = className;
  original.src = item.proofImageUrl;
  original.alt = `Preuve prix ${item.name}`;
  original.loading = 'lazy';
  const crop = item.offerEvidence?.proofCrop;
  if (!crop) { container.replaceChildren(original); return; }
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const width = crop.right - crop.left, height = crop.top - crop.bottom;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', className);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', original.alt);
  const tiles = pageTiles(crop, crop);
  if (!tiles.length) { container.replaceChildren(original); return; }
  for (const tile of tiles) {
    const image = document.createElementNS(ns, 'image');
    image.setAttribute('href', tile.url);
    image.setAttribute('x', String(tile.left * width / 100));
    image.setAttribute('y', String(tile.top * height / 100));
    image.setAttribute('width', String(tile.width * width / 100));
    image.setAttribute('height', String(tile.height * height / 100));
    image.addEventListener('error', () => container.replaceChildren(original), { once: true });
    svg.append(image);
  }
  container.replaceChildren(svg);
}
