import { money } from './product-details.js';
import { historyDay, historyDate } from './price-history-data.js';
function svgNode(tag, attrs, text) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
  if (text !== undefined) el.textContent = text;
  return el;
}
export function historyChart(points, unit, onSelect) {
  const container = document.createElement('div');
  const selection = document.createElement('div');
  selection.className = 'history-point-detail';
  selection.setAttribute('role', 'status');
  selection.setAttribute('aria-live', 'polite');
  const svg = svgNode('svg', { viewBox: '0 0 520 240', role: 'group', 'aria-label': 'Prix par date. Sélectionnez un point pour voir le montant.', class: 'price-chart' });
  const minimum = Math.min(...points.map(point => point.price));
  const maximum = Math.max(...points.map(point => point.price));
  const padding = Math.max((maximum - minimum) * .2, maximum * .08, .1);
  const low = Math.max(0, minimum - padding), high = maximum + padding;
  const first = historyDay(points[0].date).getTime(), last = historyDay(points.at(-1).date).getTime();
  const x = point => first === last ? 272 : 66 + (historyDay(point.date).getTime() - first) / (last - first) * 412;
  const y = point => 196 - (point.price - low) / (high - low) * 164;
  for (let i = 0; i <= 3; i++) {
    const value = low + (high - low) * i / 3, cy = y({ price: value });
    svg.append(svgNode('line', { x1: 66, y1: cy, x2: 478, y2: cy, class: 'chart-rule' }),
      svgNode('text', { x: 56, y: cy + 4, 'text-anchor': 'end', class: 'chart-label' }, money(value)));
  }
  svg.append(svgNode('polyline', { points: points.map(point => `${x(point)},${y(point)}`).join(' '), class: 'chart-line' }));
  const groups = [], navigation = [];
  function select(index) {
    const point = points[index], previous = points[index - 1];
    groups.forEach((group, i) => group.setAttribute('aria-pressed', String(i === index)));
    navigation.forEach(({ button, step }) => { button.disabled = index + step < 0 || index + step >= points.length; });
    const change = previous ? point.price - previous.price : null;
    selection.replaceChildren();
    const date = document.createElement('span'), price = document.createElement('strong'), delta = document.createElement('small');
    date.textContent = historyDate(point.date, true); price.textContent = `${money(point.price)}${unit}`;
    delta.textContent = change === null ? 'Premier relevé de cette série' : Math.abs(change) < .005 ? 'Même prix que le relevé précédent' : `${change > 0 ? '+' : '−'}${money(Math.abs(change))}${unit} depuis le ${historyDate(previous.date)}`;
    selection.append(price, date, delta);
    onSelect?.(point);
  }
  for (const [index, point] of points.entries()) {
    const group = svgNode('g', { role: 'button', tabindex: 0, class: 'chart-hit', 'aria-label': `${historyDate(point.date, true)} : ${money(point.price)}${unit}`, 'aria-pressed': false });
    group.append(svgNode('circle', { cx: x(point), cy: y(point), r: 16, class: 'chart-target' }),
      svgNode('circle', { cx: x(point), cy: y(point), r: 4.5, class: 'chart-point' }));
    group.addEventListener('click', event => {
      // Touch targets overlap on small screens: choose the closest visible dot.
      const cursor = svg.createSVGPoint(); cursor.x = event.clientX; cursor.y = event.clientY;
      const location = cursor.matrixTransform(svg.getScreenCTM().inverse());
      const nearest = points.reduce((best, candidate, i) =>
        Math.hypot(x(candidate) - location.x, y(candidate) - location.y) < Math.hypot(x(points[best]) - location.x, y(points[best]) - location.y) ? i : best, index);
      select(nearest);
    });
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(index); }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); const next = Math.max(0, Math.min(points.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
        groups[next].focus(); select(next);
      }
    });
    groups.push(group); svg.append(group);
  }
  svg.append(svgNode('text', { x: 66, y: 226, class: 'chart-label' }, historyDate(points[0].date)),
    svgNode('text', { x: 478, y: 226, 'text-anchor': 'end', class: 'chart-label' }, historyDate(points.at(-1).date)));
  const controls = document.createElement('div'); controls.className = 'history-point-banner';
  for (const [label, step] of [['Relevé précédent', -1], ['Relevé suivant', 1]]) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'list-action history-point-step';
    button.setAttribute('aria-label', label); button.title = label;
    const icon = document.createElement('span'); icon.className = `disclosure-icon ${step < 0 ? 'previous' : 'next'}`; icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span'); text.className = 'history-point-step-label'; text.textContent = step < 0 ? 'Précédent' : 'Suivant';
    button.append(...(step < 0 ? [icon, text] : [text, icon]));
    button.addEventListener('click', () => {
      const current = groups.findIndex(group => group.getAttribute('aria-pressed') === 'true');
      select(Math.max(0, Math.min(points.length - 1, current + step)));
    }); navigation.push({ button, step });
  }
  select(points.length - 1);
  controls.append(navigation[0].button, selection, navigation[1].button);
  container.append(svg, controls);
  return container;
}
