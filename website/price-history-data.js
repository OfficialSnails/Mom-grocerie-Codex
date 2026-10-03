// Archive browsing stays independent from current-week savings calculations.
export const historyDay = date => new Date(`${date.slice(0, 10)}T12:00:00Z`);
export const historyDate = (date, full = false) => historyDay(date).toLocaleDateString('fr-CA', {
  day: 'numeric', month: full ? 'long' : 'short', ...(full ? { year: 'numeric' } : {}),
});
export const historySearchKey = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function historyTitle(value) {
  const text = String(value).trim().toLocaleLowerCase('fr-CA').replace(/\b(pc|bbq|iga)\b/g, word => word.toUpperCase());
  return text.charAt(0).toLocaleUpperCase('fr-CA') + text.slice(1);
}
export const historySource = item => item.source === 'csv' ? 'Import CSV' : 'Circulaire';
export function flyerHistoryCatalog(catalogue) {
  const series = catalogue.series.filter(item => (item.source || 'flipp') === 'flipp' && item.points.length);
  let observationCount = 0, from = null, to = null;
  for (const item of series) {
    for (const point of item.points) {
      observationCount++;
      if (!from || point.date < from) from = point.date;
      if (!to || point.date > to) to = point.date;
    }
  }
  return { ...catalogue, series, observationCount, from, to };
}
export function historyFormat(item) {
  if (item.format) return item.format.replace(/^1x/, '').replace(/x/g, ' × ').replace(/(\d)(kg|g|ml|l|lb)\b/gi, '$1 $2').replace(/(\d)\.(\d)/g, '$1,$2')
    .replace(/\b(each|ea|units?|unités?|un)\b/gi, 'unités');
  const units = { lb: 'La livre', kg: 'Le kilogramme', '100g': '100 g', l: 'Le litre' };
  return units[item.unit?.toLowerCase()] || 'Format non renseigné';
}
export function historyStats(points) {
  const prices = points.map(point => point.price).sort((a, b) => a - b);
  const middle = Math.floor(prices.length / 2);
  const lastDate = points.at(-1)?.date;
  const latest = [...new Set(points.filter(point => point.date === lastDate).map(point => point.price))].sort((a, b) => a - b);
  return { low: prices[0], high: prices.at(-1), latest,
    median: prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2,
    dates: new Set(points.map(point => point.date)).size,
    changed: prices.at(-1) - prices[0] > .005 };
}
export function filterHistory(series, { query = '', store = '', source = '', months = 'all', changed = false, sort = 'records', endDate }) {
  const words = historySearchKey(query).split(' ').filter(Boolean);
  const cutoff = historyDay(endDate);
  if (months !== 'all') cutoff.setUTCMonth(cutoff.getUTCMonth() - Number(months));
  const filtered = [];
  for (const item of series) {
    if ((store && item.storeId !== store) || (source && (item.source || 'flipp') !== source)) continue;
    if (!words.every(word => historySearchKey(item.name).includes(word))) continue;
    const points = item.points.filter(point => months === 'all' || historyDay(point.date) >= cutoff);
    if (!points.length || (changed && !historyStats(points).changed)) continue;
    filtered.push({ ...item, points });
  }
  return filtered.sort((a, b) => {
    if (sort === 'name') return historyTitle(a.name).localeCompare(historyTitle(b.name), 'fr') || a.storeName.localeCompare(b.storeName, 'fr');
    if (sort === 'recent') return b.points.at(-1).date.localeCompare(a.points.at(-1).date) || b.points.length - a.points.length;
    return b.points.length - a.points.length || a.name.localeCompare(b.name, 'fr');
  });
}
