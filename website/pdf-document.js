import { productTitle } from './product-details.js';

// Print equivalents of DESIGN.md: evergreen, linen, muted green and 4/8/16/24 spacing.
export const printColors = { ink: '#171714', green: '#2d4739', muted: '#5c7066', pale: '#e5f0e9', rule: '#dadad7', linen: '#faf9f6' };
export const printMoney = value => `${(Math.round(Number(value) * 100) / 100).toFixed(2).replace('.', ',')} $`;
export const printCount = (count, noun) => `${count} ${noun}${count > 1 ? 's' : ''}`;
export const printCaveat = 'Avant taxes et dépôts · Prix au poids selon les quantités réelles.';

export function drawShoppingPdf(pdf, { week, stores, estimate, savings, notes = '' }) {
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 32, right = width - margin, content = width - margin * 2;
  const bottom = height - 36, priceWidth = 88, nameWidth = content - priceWidth - 24;
  let y = margin;
  const font = (size = 11, bold = false, color = printColors.ink) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(color);
  };
  const text = (value, x, top, size = 11, bold = false, color = printColors.ink, align = 'left') => {
    font(size, bold, color);
    // Preserve arrays: String(array) inserts commas and destroys wrapped lines.
    pdf.text(value, x, top, { align, lineHeightFactor: 1.35 });
  };
  const centeredText = (lines, x, top, blockHeight, size, bold, color, align = 'left') => {
    const count = Array.isArray(lines) ? lines.length : 1;
    const baseline = top + blockHeight / 2 + size * .3 - (count - 1) * size * 1.35 / 2;
    text(lines, x, baseline, size, bold, color, align);
  };
  const wrap = (value, maxWidth, size = 11, bold = false) => {
    font(size, bold);
    return pdf.splitTextToSize(String(value), maxWidth);
  };
  const fill = (top, blockHeight, color, radius = 0) => {
    pdf.setFillColor(color);
    if (radius) pdf.roundedRect(margin, top, content, blockHeight, radius, radius, 'F');
    else pdf.rect(margin, top, content, blockHeight, 'F');
  };
  const rule = top => {
    pdf.setDrawColor(printColors.rule);
    pdf.setLineWidth(0.5);
    pdf.line(margin, top, right, top);
  };
  const newPage = () => { pdf.addPage(); y = margin; };
  const ensure = space => { if (y + space > bottom) newPage(); };
  const count = stores.reduce((sum, store) => sum + store.items.length, 0);

  text('Liste d’épicerie', margin, y + 17, 18, true, printColors.green);
  text(`${printCount(count, 'produit')} · ${printCount(stores.length, 'épicerie')}`, right, y + 9, 8, false, printColors.muted, 'right');
  const context = wrap([week?.regionName, week?.weekRange || week?.folderName].filter(Boolean).join(' · '), content, 9);
  text(context, margin, y + 33, 9, false, printColors.muted);
  y += 42 + (context.length - 1) * 12;
  text(`Total estimé : ${printMoney(estimate.subtotal)}`, margin, y + 11, 10, true, printColors.green);
  if (savings?.amount > 0) text(`Économies : ${printMoney(savings.amount)}`, right, y + 11, 10, false, printColors.green, 'right');
  y += 24;

  function headingLines(store, continued = false) {
    const label = `${store.name}${continued ? ' · suite' : ''}`;
    font(12, true);
    const nameWidth = Math.min(170, pdf.getTextWidth(label) + 16);
    return {
      names: wrap(label, nameWidth, 12, true),
      addresses: store.address ? wrap(store.address, content - nameWidth - 36, 8.5) : [],
    };
  }
  function headingHeight(store) {
    const { names, addresses } = headingLines(store);
    return Math.max(names.length * 16.2, addresses.length * 11.475) + 10;
  }
  function storeHeading(store, continued = false) {
    const { names, addresses } = headingLines(store, continued);
    const blockHeight = Math.max(names.length * 16.2, addresses.length * 11.475) + 10;
    fill(y, blockHeight, printColors.green, 3);
    centeredText(names, margin + 8, y, blockHeight, 12, true, '#ffffff');
    if (addresses.length) centeredText(addresses, right - 8, y, blockHeight, 8.5, false, printColors.pale, 'right');
    y += blockHeight;
  }

  const noteSpace = notes.trim() ? 24 + wrap(notes.trim(), content, 9).length * 12.5 : 0;
  for (const [storeIndex, store] of stores.entries()) {
    if (storeIndex) newPage();
    ensure(headingHeight(store) + 35);
    storeHeading(store);
    for (const [itemIndex, item] of store.items.entries()) {
      const lines = wrap(productTitle(item.name) || item.name, nameWidth, 9.5);
      const prices = wrap(item.price || 'À vérifier', priceWidth - 8, 10);
      let first = true;
      while (lines.length || first) {
        const remaining = lines.length * 13;
        const wanted = Math.max(18, remaining + 4.5, first ? prices.length * 13.5 + 4.5 : 0);
        const lastItem = itemIndex === store.items.length - 1;
        const closingSpace = lastItem ? 28 + (storeIndex === stores.length - 1 ? 38 + Math.min(noteSpace, 200) : 0) : 0;
        // Keep a store's subtotal and the closing total with its final product.
        if (y + Math.min(wanted, 100) + closingSpace > bottom) { newPage(); storeHeading(store, true); }
        const capacity = bottom - y - 4.5;
        const namePart = lines.splice(0, Math.floor(capacity / 13));
        const rowHeight = Math.max(18, namePart.length * 13 + 4.5, first ? prices.length * 13.5 + 4.5 : 0);
        if (namePart.length) centeredText(namePart, margin + 8, y, rowHeight, 9.5, false, printColors.ink);
        if (first) centeredText(prices, right - 8, y, rowHeight, 10, false, printColors.ink, 'right');
        y += rowHeight;
        rule(y);
        first = false;
      }
    }
    if (y + 24 > bottom) { newPage(); storeHeading(store, true); }
    centeredText('Sous-total estimé', margin + 8, y, 24, 9.5, true, printColors.green);
    centeredText(printMoney(store.estimate.subtotal), right - 8, y, 24, 9.5, true, printColors.green, 'right');
    y += 28;
  }

  if (notes.trim()) {
    const lines = wrap(notes.trim(), content, 9);
    while (lines.length) {
      ensure(38);
      text('Notes', margin, y + 10, 10, true, printColors.green);
      y += 14;
      const part = lines.splice(0, Math.max(1, Math.floor((bottom - y - 10) / 12.5)));
      text(part, margin, y + 9, 9, false, printColors.muted);
      y += part.length * 12.5 + 10;
    }
  }
  const caveatLines = wrap(printCaveat, content, 8);
  ensure(38 + (caveatLines.length - 1) * 11);
  fill(y, 24, printColors.green, 4);
  centeredText('Total estimé de la liste', margin + 8, y, 24, 10, true, '#ffffff');
  centeredText(printMoney(estimate.subtotal), right - 8, y, 24, 14, true, '#ffffff', 'right');
  text(caveatLines, margin, y + 36, 8, false, printColors.muted);

  const pages = pdf.internal.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    text('La liste d’épicerie', margin, height - 24, 8, false, printColors.muted);
    text(`${page} / ${pages}`, right, height - 24, 8, false, printColors.muted, 'right');
  }
  return pdf;
}
