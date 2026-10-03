import { money, assessPriceHistory } from './product-details.js';
import { historyChart } from './price-history-chart.js';
import { historyDate } from './price-history-data.js';

function node(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// Per-offer context is separate from the full searchable archive workspace.
export function priceContext(item) {
  const facts = item.offerEvidence;
  const history = facts?.history ?? facts?.observations;
  if (!history?.points?.length) return null;
  const assessment = assessPriceHistory(item);
  const section = node('section', 'price-context');
  const unit = /^(lb|kg|100g|l)$/i.test(facts.unit ?? '') ? `/${facts.unit}` : '';
  const start = item.saleStart?.slice(0, 10) || item.id.slice(0, 10);
  const points = [...history.points, { date: start, price: Number(item.currentPrice), current: true }];
  if (assessment) {
    const intro = node('div', 'comparison-saving');
    intro.append(node('strong', '', assessment.label));
    intro.append(node('span', '', assessment.percent
      ? `${assessment.percent} % ${assessment.below ? 'sous' : 'au-dessus de'} la médiane de ${money(assessment.median)}${unit}.`
      : `Au niveau de la médiane : ${money(assessment.median)}${unit}.`));
    section.append(intro);
    const prior = assessment.lastSame ?? assessment.previous;
    if (prior) section.append(node('p', 'list-caption', `${assessment.lastSame ? 'Même prix relevé' : `${money(prior.price)}${unit} relevé`} le ${historyDate(prior.date, true)}.`));
  }
  section.append(node('p', 'list-caption', `${item.storeName} · ${history.weeks} semaines observées · ${historyDate(history.from)} au ${historyDate(start)}`));
  // Only confirmed history inherits the current sale unit.
  section.append(historyChart(points, assessment ? unit : ''));
  const key = node('dl', 'price-context-key');
  for (const [label, price] of [
    ['Cette semaine', item.currentPrice],
    ...(assessment ? [['Plus bas observé', assessment.low]] : []),
  ]) {
    const metric = node('div', '');
    metric.append(node('dt', '', label), node('dd', '', `${money(price)}${unit}`));
    key.append(metric);
  }
  section.append(key);
  const records = node('details', 'history-records');
  records.append(node('summary', '', 'Voir les relevés'));
  const table = node('table', '');
  const head = node('thead', ''), header = node('tr', '');
  header.append(node('th', '', 'Date'), node('th', '', 'Prix')); head.append(header); table.append(head);
  const body = node('tbody', '');
  for (const point of points.slice().reverse()) {
    const row = node('tr', '');
    row.append(node('td', '', point.current ? 'Cette semaine' : historyDate(point.date, true)), node('td', '', money(point.price)));
    body.append(row);
  }
  table.append(body); records.append(table); section.append(records);
  if (assessment) section.append(node('p', 'list-caption', 'Prix de circulaire pour le même format. Prix habituel : à moins de 10 % de la médiane des semaines observées.'));
  return section;
}
