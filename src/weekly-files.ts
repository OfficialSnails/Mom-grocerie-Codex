import { format } from 'date-fns';
import { frCA } from 'date-fns/locale';

export const FINAL_LIST_FILE = "00 Liste d'épicerie.md";
export const PICKER_FILE = "01 Choix d'items.md";
export const STORE_SUMMARY_FILE = '02 Sélection par épicerie.md';
export const TECHNICAL_DIR = 'Autres';

export const LEGACY_FINAL_LIST_FILES = ['00-final-list.md', 'final-list.md'];
export const LEGACY_PICKER_FILES = ['01-shopping-picker.md', 'shopping-picker.md', 'shopping-list.md', '02-shopping-list.md'];
export const LEGACY_STORE_SUMMARY_FILES = ['02-store-summary.md', '03-store-summary.md', 'store-summary.md'];
export const LEGACY_TECHNICAL_DIRS = ['working'];

export function flyerWeekRangeDates(reportDate: Date): { start: Date; end: Date } {
  const start = new Date(reportDate);
  start.setHours(0, 0, 0, 0);
  const daysSinceThursday = (start.getDay() - 4 + 7) % 7;
  start.setDate(start.getDate() - daysSinceThursday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function frenchWeekLabel(reportDate: Date): string {
  const { start, end } = flyerWeekRangeDates(reportDate);
  const startDay = format(start, 'd', { locale: frCA });
  const endDay = format(end, 'd', { locale: frCA });
  const startMonth = format(start, 'MMMM', { locale: frCA });
  const month = format(end, 'MMMM', { locale: frCA });
  const startYear = format(start, 'yyyy', { locale: frCA });
  const year = format(end, 'yyyy', { locale: frCA });

  if (startMonth === month && startYear === year) {
    return `${startDay} au ${endDay} ${month} ${year}`;
  }

  if (startYear === year) {
    return `${startDay} ${startMonth} au ${endDay} ${month} ${year}`;
  }

  return `${startDay} ${startMonth} ${startYear} au ${endDay} ${month} ${year}`;
}

export function frenchWeekFolderName(reportDate: Date): string {
  return `Semaine du ${frenchWeekLabel(reportDate)}`;
}
