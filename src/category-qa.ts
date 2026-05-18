import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { findSuspiciousCategoryItems, type PantryQaInput } from './generate-report.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const indexPath = join(rootDir, 'website', 'data', 'weeks', 'index.json');
const qaDir = join(rootDir, 'reports', 'qa');

interface WeekIndex {
  weeks: Array<{ slug: string; path?: string }>;
}

interface WeekCategory {
  id: string;
  title?: string;
  items: PantryQaInput[];
}

interface WeekJson {
  slug: string;
  title?: string;
  allCategories?: WeekCategory[];
  dealCategories?: WeekCategory[];
  categories?: WeekCategory[];
}

function activeWeekPath(): string {
  const index = JSON.parse(readFileSync(indexPath, 'utf8')) as WeekIndex;
  const week = index.weeks[0];
  if (!week) throw new Error('No generated website week found.');
  return join(rootDir, 'website', 'data', 'weeks', week.slug, 'week.json');
}

function findingMarkdown(finding: ReturnType<typeof findSuspiciousCategoryItems>[number]): string {
  return [
    `- **Product:** ${finding.itemName}`,
    `  - Current category: ${finding.currentCategory}`,
    `  - Suggested category: ${finding.suggestedCategoryTitle}`,
    `  - Store: ${finding.storeName}`,
    `  - Price: ${finding.price || 'n/a'}`,
    `  - Reason: ${finding.reason}`,
  ].join('\n');
}

const weekPath = process.argv[2] ? join(process.cwd(), process.argv[2]) : activeWeekPath();
const week = JSON.parse(readFileSync(weekPath, 'utf8')) as WeekJson;
const categories = week.allCategories ?? week.dealCategories ?? week.categories ?? [];
const findings = findSuspiciousCategoryItems(categories);
const high = findings.filter(finding => finding.severity === 'high');
const ambiguous = findings.filter(finding => finding.severity === 'ambiguous');
const scanned = categories.reduce((sum, category) => sum + (category.items?.length ?? 0), 0);
const categoryCounts = findings.reduce((counts, finding) => {
  counts.set(finding.currentCategory, (counts.get(finding.currentCategory) ?? 0) + 1);
  return counts;
}, new Map<string, number>());
const busiestCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Aucune';

const report = [
  '# CATEGORY QA REPORT',
  '',
  '## Summary',
  '',
  `- products scanned: ${scanned}`,
  `- high-confidence errors: ${high.length}`,
  `- ambiguous review items: ${ambiguous.length}`,
  `- category with most suspicious items: ${busiestCategory}`,
  '',
  '## High-confidence errors',
  '',
  high.length ? high.map(findingMarkdown).join('\n\n') : '- None',
  '',
  '## Ambiguous / needs human review',
  '',
  ambiguous.length ? ambiguous.map(findingMarkdown).join('\n\n') : '- None',
  '',
  '## Suggested classifier rule additions',
  '',
  high.length
    ? '- Add or adjust reusable classifier keywords for the high-confidence examples above, then regenerate from existing raw JSON.'
    : '- No high-confidence classifier changes suggested.',
].join('\n');

if (!existsSync(qaDir)) mkdirSync(qaDir, { recursive: true });
const reportPath = join(qaDir, `category-review-${week.slug}.md`);
writeFileSync(reportPath, report, 'utf8');

console.log(report);
console.log('');
console.log(`Report written: ${reportPath}`);

if (high.length > 0) process.exit(1);
