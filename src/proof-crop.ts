export interface Rectangle { left: number; right: number; top: number; bottom: number }
export interface ProofCrop extends Rectangle {
  imageBase: string; height: number; level: number; tileSpan: number;
}
export interface SourcePhotoItem extends Partial<Rectangle> {
  price: string; text_areas?: Rectangle[];
}
interface FlyerImage {
  imageBase: string; height: number; level: number; tileSpan: number; pages: Rectangle[];
}
const valid = (r: Partial<Rectangle>): r is Rectangle =>
  [r.left, r.right, r.top, r.bottom].every(Number.isFinite) && r.right! > r.left! && r.top! > r.bottom!;
const area = (r: Rectangle) => (r.right - r.left) * (r.top - r.bottom);
function union(a: Rectangle, b: Rectangle): Rectangle {
  return { left: Math.min(a.left, b.left), right: Math.max(a.right, b.right),
    top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) };
}
function overlap(a: Rectangle, b: Rectangle): number {
  const intersection = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom));
  return intersection / (area(a) + area(b) - intersection);
}

// Repair sliver cutouts using only the source's associated offer text and, when
// shared, the other pictures belonging to that same-price printed offer.
export function expandedProofCrop(item: SourcePhotoItem, items: SourcePhotoItem[], flyer?: FlyerImage): ProofCrop | undefined {
  if (!flyer || !valid(item) || !(flyer.tileSpan > 0) || !(flyer.height > 0) ||
    !/^https:\/\/f\.wishabi\.net\/flyers\/[a-z\d-]+\/$/i.test(flyer.imageBase)) return;
  const ratio = (item.right - item.left) / (item.top - item.bottom);
  if (ratio >= .45 && ratio <= 3) return;
  const page = flyer.pages.find(p => valid(p) && item.left >= p.left && item.right <= p.right && item.top <= p.top && item.bottom >= p.bottom);
  if (!page) return;
  const texts = (item.text_areas ?? []).filter(t => valid(t) && t.left >= page.left && t.right <= page.right && t.top <= page.top && t.bottom >= page.bottom &&
    // Disconnected text can describe a different tile in long composite pages.
    area(union(item, t)) <= 8 * area(item));
  if (!texts.length) return;
  let crop = texts.reduce(union, item as Rectangle);
  for (const other of items) {
    if (!valid(other) || other === item || other.price !== item.price) continue;
    if (!(other.text_areas ?? []).some(t => valid(t) && texts.some(own => overlap(t, own) > .8))) continue;
    const expanded = union(crop, other);
    if (area(expanded) <= area(crop) * 2) crop = expanded;
  }
  const newRatio = (crop.right - crop.left) / (crop.top - crop.bottom);
  if (newRatio < .45 || newRatio > 3 || area(crop) > area(page) * .4) return;
  const padding = Math.min(crop.right - crop.left, crop.top - crop.bottom) * .02;
  return { imageBase: flyer.imageBase, height: flyer.height, level: flyer.level, tileSpan: flyer.tileSpan,
    left: Math.max(page.left, crop.left - padding), right: Math.min(page.right, crop.right + padding),
    top: Math.min(page.top, crop.top + padding), bottom: Math.max(page.bottom, crop.bottom - padding) };
}
