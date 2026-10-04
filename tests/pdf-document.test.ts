import { describe, expect, it } from 'vitest';
// @ts-expect-error Shared static PDF renderer.
import { drawShoppingPdf, printMoney } from '../website/pdf-document.js';
// @ts-expect-error Shared static print template.
import { buildShoppingPrintHtml } from '../website/print-document.js';
import { estimateBasketTotal } from '../src/price-estimate.js';

const items = [
  { name: 'CÉLERI', price: '0,99 $', currentPrice: .99, storeId: 'metro-joliette', offerEvidence: { member: true } },
  { name: 'Bananes', price: '0,79 $/lb', currentPrice: .79, unit: 'lb' },
];
const model = {
  week: { regionName: 'Joliette', weekRange: '1 au 7 octobre 2026' },
  stores: [{ name: 'Metro', address: '180 Rue Beaudry Nord, Joliette J6E 6A6', items, estimate: estimateBasketTotal(items) }],
  estimate: estimateBasketTotal(items), savings: { amount: 1.5 }, notes: '',
};

// Record drawing bounds independently of the production pagination calculations.
class PdfRecorder {
  page = 1; pages = 1; size = 11; weight = 'normal';
  entries: { value: string | string[]; x: number; y: number; page: number; bottom: number; align: string; weight: string }[] = [];
  banners: { y: number; height: number; page: number }[] = [];
  internal = { pageSize: { getWidth: () => 612, getHeight: () => 792 }, getNumberOfPages: () => this.pages };
  setFont(_family: string, weight: string) { this.weight = weight; }
  setTextColor() {} setDrawColor() {} setLineWidth() {} setFillColor() {} rect() {} line() {}
  roundedRect(_x: number, y: number, _width: number, height: number) { this.banners.push({ y, height, page: this.page }); }
  setFontSize(size: number) { this.size = size; }
  getTextWidth(value: string) { return value.length * this.size * .52; }
  splitTextToSize(value: string, width: number) {
    const length = Math.max(1, Math.floor(width / (this.size * .52)));
    return value.split('\n').flatMap(line => line.match(new RegExp(`.{1,${length}}`, 'g')) ?? ['']);
  }
  text(value: string | string[], x: number, y: number, options: any) {
    this.entries.push({ value, x, y, page: this.page, bottom: y + (Array.isArray(value) ? value.length - 1 : 0) * this.size * options.lineHeightFactor, align: options.align, weight: this.weight });
  }
  addPage() { this.page = ++this.pages; }
  setPage(page: number) { this.page = page; }
}

describe('compact shopping PDF', () => {
  it('preserves safe totals, unit prices and escaped content without removed annotations', () => {
    const html = buildShoppingPrintHtml({ ...model, notes: '<script> & notes' });
    expect(html).toContain('0,79 $/lb');
    expect(html).toContain('0,99 $');
    expect(html).toContain('1,50 $');
    expect(html).toContain('&lt;script&gt; &amp; notes');
    expect(html).not.toContain('Avec carte Moi');
    expect(html).not.toContain('Non inclus');
    expect(html).not.toContain('Prix en CAD');
    expect(html).toContain('quantités réelles');
    expect(model.estimate.subtotal).toBe(.99);
    expect(printMoney(2.675)).toBe('2,68 $');
  });

  it('uses one compact store heading with its address on the right and aligned prices', () => {
    const pdf = new PdfRecorder();
    drawShoppingPdf(pdf, model);
    const title = pdf.entries.find(entry => Array.isArray(entry.value) && entry.value[0] === 'Metro')!;
    const address = pdf.entries.find(entry => Array.isArray(entry.value) && entry.value[0].startsWith('180 Rue'))!;
    expect(Math.abs(title.y - address.y)).toBeLessThanOrEqual(2);
    expect(address.align).toBe('right');
    expect(address.x).toBe(572);
    const prices = pdf.entries.filter(entry => Array.isArray(entry.value) && /\$/.test(entry.value.join('')));
    expect(prices.length).toBe(2);
    expect(prices.every(entry => entry.align === 'right' && entry.x === 572)).toBe(true);
    expect(prices.every(entry => entry.weight === 'normal')).toBe(true);
    expect(pdf.entries.find(entry => entry.value === 'Sous-total estimé')?.weight).toBe('bold');
    expect(pdf.entries.find(entry => entry.value === 'Total estimé de la liste')?.weight).toBe('bold');
    expect(pdf.entries.some(entry => entry.value === 'Prix en CAD')).toBe(false);
    expect(pdf.banners[0].y).toBeLessThan(title.y);
    expect(pdf.banners[0].y + pdf.banners[0].height).toBeGreaterThan(address.bottom);
    expect(pdf.pages).toBe(1);
    const caveat = pdf.entries.find(entry => Array.isArray(entry.value) && entry.value[0].startsWith('Avant taxes'))!;
    expect(caveat.bottom).toBeLessThan(400);
  });

  it('fits thirty short products and totals on one letter page', () => {
    const thirty = Array.from({ length: 30 }, (_, index) => ({ ...items[0], name: `Produit ${index}` }));
    const pdf = new PdfRecorder();
    drawShoppingPdf(pdf, { ...model, stores: [{ ...model.stores[0], items: thirty }] });
    expect(pdf.pages).toBe(1);
    expect(pdf.entries.some(entry => entry.value === 'Total estimé de la liste')).toBe(true);
  });

  it('starts each grocery on its own page and centers prices beside wrapped text', () => {
    const sampleItems = Array.from({ length: 30 }, (_, index) => ({ ...items[0], name: `Produit ${index}`, price: '129,99 $' }));
    sampleItems[0].name = 'Assortiment familial de fromages du Québec, noix et fruits séchés — grand plateau avec craquelins et confitures artisanales';
    const pdf = new PdfRecorder();
    drawShoppingPdf(pdf, { ...model, stores: ['Metro', 'Super C', 'IGA'].map((name, index) => ({ ...model.stores[0], name, items: sampleItems.slice(index * 10, index * 10 + 10) })), estimate: { subtotal: 3899.7 } });
    expect(pdf.pages).toBe(3);
    for (const [index, name] of ['Metro', 'Super C', 'IGA'].entries()) {
      expect(pdf.entries.find(entry => Array.isArray(entry.value) && entry.value[0] === name)?.page).toBe(index + 1);
    }
    expect(pdf.banners).toHaveLength(4); // Three groceries and the final total.
    const wrapped = pdf.entries.find(entry => Array.isArray(entry.value) && entry.value[0].startsWith('Assortiment'))!;
    const price = pdf.entries.find(entry => Array.isArray(entry.value) && entry.value[0] === '129,99 $')!;
    expect(price.y).toBeGreaterThan(wrapped.y);
    expect(price.y).toBeLessThan(wrapped.bottom);
    expect(pdf.entries.some(entry => entry.value === '3899,70 $')).toBe(true);
  });

  it('keeps the final total with the last product when short notes push the ending to another page', () => {
    const thirty = Array.from({ length: 30 }, (_, index) => ({ ...items[0], name: `Produit ${index}` }));
    const pdf = new PdfRecorder();
    drawShoppingPdf(pdf, { ...model, stores: [{ ...model.stores[0], items: thirty }], notes: 'Apporter les sacs.\nVérifier les quantités.' });
    const lastProduct = pdf.entries.find(entry => Array.isArray(entry.value) && entry.value[0] === 'Produit 29');
    expect(pdf.entries.find(entry => entry.value === 'Total estimé de la liste')?.page).toBe(lastProduct?.page);
  });

  it('keeps wrapped names as lines and repeats the destination on continued pages', () => {
    const longItems = Array.from({ length: 55 }, (_, index) => ({ ...items[0], name: `Produit ${index} : biscuits et céréales en grand format avec une description longue et lisible` }));
    const pdf = new PdfRecorder();
    drawShoppingPdf(pdf, { ...model, stores: [{ ...model.stores[0], items: longItems }], notes: 'Notes de courses\n'.repeat(80) });
    expect(pdf.pages).toBeGreaterThan(2);
    expect(pdf.entries.some(entry => Array.isArray(entry.value) && entry.value[0].includes('· suite'))).toBe(true);
    const text = pdf.entries.flatMap(entry => entry.value).join('\n');
    for (let index = 0; index < 55; index++) expect(text).toContain(`Produit ${index} :`);
    expect(text).not.toContain('CÉLERI,Avec');
    expect(pdf.entries.every(entry => entry.y >= 32 && entry.bottom <= (entry.y === 768 ? 768 : 756))).toBe(true);
  });
});
