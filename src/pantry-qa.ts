import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { findSuspiciousPantryItems, type PantryQaInput } from './generate-report.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const indexPath = join(rootDir, 'website', 'data', 'weeks', 'index.json');

interface WeekIndex {
  weeks: Array<{ slug: string; path?: string }>;
}

interface WeekCategory {
  id: string;
  items: PantryQaInput[];
}

interface WeekJson {
  allCategories?: WeekCategory[];
  dealCategories?: WeekCategory[];
  categories?: WeekCategory[];
}

function activeWeekPath(): string {
  const index = JSON.parse(readFileSync(indexPath, 'utf8')) as WeekIndex;
  const week = index.weeks[0];
  if (!week) {
    throw new Error('No generated website week found.');
  }
  return join(rootDir, 'website', 'data', 'weeks', week.slug, 'week.json');
}

const weekPath = process.argv[2] ? join(process.cwd(), process.argv[2]) : activeWeekPath();
const week = JSON.parse(readFileSync(weekPath, 'utf8')) as WeekJson;
const pantryItems = (week.allCategories ?? week.dealCategories ?? week.categories ?? [])
  .find(category => category.id === 'pantry')
  ?.items ?? [];

const findings = findSuspiciousPantryItems(pantryItems);

if (findings.length === 0) {
  console.log(`Pantry QA passed: no high-confidence suspicious pantry items in ${weekPath}`);
  process.exit(0);
}

console.error(`Pantry QA found ${findings.length} suspicious pantry item(s) in ${weekPath}`);
for (const finding of findings) {
  console.error(`- ${finding.itemName} | ${finding.storeName} | ${finding.price} -> ${finding.suggestedCategoryTitle} (${finding.reason})`);
}

process.exit(1);
