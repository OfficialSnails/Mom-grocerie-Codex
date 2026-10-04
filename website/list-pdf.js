import { drawShoppingPdf } from './pdf-document.js';
const slug = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'ma-liste-epicerie';

async function loadJsPdf() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;

  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = resolve;
    script.onerror = () => reject(new Error('PDF library unavailable'));
    document.head.append(script);
  });

  if (!window.jspdf?.jsPDF) throw new Error('PDF library unavailable');
  return window.jspdf.jsPDF;
}

export async function createListPdf(snapshot) {
  const JsPdf = await loadJsPdf();
  const pdf = new JsPdf({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  drawShoppingPdf(pdf, snapshot);
  const week = snapshot.week;
  return { pdf, fileName: `${slug(['Ma liste d’épicerie', week.regionName, week.weekRange || week.folderName].filter(Boolean).join(' - '))}.pdf` };
}
