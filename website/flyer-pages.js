// Wishabi pages are rectangles in a tiled flyer. Keep the original image pixels.
export function pageTiles(flyer, page) {
  const span = flyer.tileSpan;
  if (!(span > 0)) return [];
  const width = page.right - page.left;
  const height = page.top - page.bottom;
  const top = flyer.height + page.top;
  const bottom = flyer.height + page.bottom;
  const tiles = [];
  for (let y = Math.ceil(top / span) - 1; y >= Math.floor(bottom / span); y--) {
    for (let x = Math.floor(page.left / span); x < Math.ceil(page.right / span); x++) {
      tiles.push({
        url: `${flyer.imageBase}${flyer.level}_${x}_${y}.jpg`,
        left: (x * span - page.left) / width * 100,
        top: (top - (y + 1) * span) / height * 100,
        width: span / width * 100, height: span / height * 100,
      });
    }
  }
  return tiles;
}
