import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { basename, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { obsidianFrontmatter } from './obsidian-style.js';
import { FINAL_LIST_FILE, LEGACY_FINAL_LIST_FILES, LEGACY_PICKER_FILES, LEGACY_TECHNICAL_DIRS, PICKER_FILE, TECHNICAL_DIR } from './weekly-files.js';

interface PickerItem {
  id: string;
  item_name: string;
  store_id: string;
  store_name: string;
  price: string;
  category: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const __filename = fileURLToPath(import.meta.url);
const WEEKS_DIR = join(__dirname, '..', 'reports', 'weeks');
const CATEGORY_PICKER = PICKER_FILE;
const FINAL_LIST = FINAL_LIST_FILE;
const PICKER_FILE_NAMES = [PICKER_FILE, ...LEGACY_PICKER_FILES];
const FINAL_LIST_FILE_NAMES = [FINAL_LIST_FILE, ...LEGACY_FINAL_LIST_FILES];

function latestWeekDir(): string {
  const entries = readdirSync(WEEKS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(WEEKS_DIR, entry.name))
    .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  if (entries.length === 0) {
    throw new Error('Aucun dossier hebdomadaire trouvé dans reports/weeks');
  }
  return entries[entries.length - 1]!;
}

function loadPickerItems(weekDir: string): PickerItem[] {
  const path = pickerItemsPath(weekDir);
  if (!existsSync(path)) throw new Error(`picker-items.json manquant dans ${weekDir}`);
  return JSON.parse(readFileSync(path, 'utf-8')) as PickerItem[];
}

function existingFile(weekDir: string, names: string[]): string {
  for (const name of names) {
    const path = join(weekDir, name);
    if (existsSync(path)) return path;
  }
  return join(weekDir, names[0]!);
}

function pickerItemsPath(weekDir: string): string {
  for (const name of [TECHNICAL_DIR, ...LEGACY_TECHNICAL_DIRS]) {
    const path = join(weekDir, name, 'picker-items.json');
    if (existsSync(path)) return path;
  }
  return join(weekDir, TECHNICAL_DIR, 'picker-items.json');
}

interface SelectedRow {
  item_name: string;
  store_name: string;
  price: string;
}

function cleanInlineMarkdown(input: string): string {
  return input
    .replace(/\*\*/g, '')
    .replace(/__+/g, '')
    .trim();
}

function stripBlockquotePrefix(line: string): string {
  return line.replace(/^>\s?/, '');
}

function parseTaskLine(line: string): { checked: boolean; item_name: string; inline_price: string } | null {
  const taskMatch = stripBlockquotePrefix(line).match(/^- \[([ xX])\] (.+)$/);
  if (!taskMatch) return null;

  const checked = taskMatch[1]!.toLowerCase() === 'x';
  let content = taskMatch[2]!.trim();
  let inline_price = '';

  const boldWithPrice = content.match(/^\*\*(.+?)\*\*(?:\s+—\s+(.+))?$/);
  if (boldWithPrice) {
    return {
      checked,
      item_name: boldWithPrice[1]!.trim(),
      inline_price: cleanInlineMarkdown(boldWithPrice[2] ?? ''),
    };
  }

  const inlinePriceMatch = content.match(/^(.+?)\s+—\s+(.+)$/);
  if (inlinePriceMatch) {
    content = inlinePriceMatch[1]!.trim();
    inline_price = cleanInlineMarkdown(inlinePriceMatch[2]!);
  }

  return { checked, item_name: content, inline_price };
}

function parseCheckedRows(path: string, defaultStoreName = ''): SelectedRow[] {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf-8');
  const lines = text.split(/\r?\n/);
  const selected: SelectedRow[] = [];
  let currentStoreName = defaultStoreName;

  for (let i = 0; i < lines.length; i += 1) {
    const storeHeader = lines[i]?.match(/^## (.+)$/);
    if (storeHeader) {
      currentStoreName = storeHeader[1]!.trim();
      continue;
    }

    const task = parseTaskLine(lines[i] ?? '');
    if (!task?.checked) continue;

    const item_name = task.item_name;
    let store_name = currentStoreName;
    let price = task.inline_price;

    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j] ?? '';
      if (parseTaskLine(line) || /^## /.test(line) || /^> \[!/.test(line)) break;
      const detailLine = stripBlockquotePrefix(line);
      const storeMatch = detailLine.match(/^\s*(?:[->] )?(?:📍\s*)?(?:\*\*)?Magasin:(?:\*\*)?\s*(.+)$/);
      const priceMatch = detailLine.match(/^\s*(?:[->] )?(?:💵\s*)?(?:\*\*)?Prix:(?:\*\*)?\s*(.+)$/);
      if (storeMatch) store_name = storeMatch[1]!.trim();
      if (priceMatch) price = priceMatch[1]!.trim();
    }

    selected.push({ item_name, store_name, price });
  }

  return selected;
}

function rowKey(row: SelectedRow): string {
  return `${row.item_name}::${row.store_name}::${row.price}`;
}

function loadCheckedIdsFromPath(path: string): string[] {
  return [...new Set(parseCheckedRows(path).map(rowKey))];
}

function selectedKeyForItem(item: PickerItem): string {
  return `${item.item_name}::${item.store_name}::${item.price}`;
}

function synchronizePickerFromFinalList(weekDir: string, checkedKeys: Set<string>): void {
  const pickerPath = existingFile(weekDir, PICKER_FILE_NAMES);
  if (!existsSync(pickerPath)) return;

  const lines = readFileSync(pickerPath, 'utf-8').split(/\r?\n/);
  const nextLines = [...lines];

  for (let i = 0; i < lines.length; i += 1) {
    const task = parseTaskLine(lines[i] ?? '');
    if (!task) continue;

    let store_name = '';
    let price = task.inline_price;
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j] ?? '';
      if (parseTaskLine(line) || /^## /.test(line) || /^> \[!/.test(line)) break;
      const detailLine = stripBlockquotePrefix(line);
      const storeMatch = detailLine.match(/^\s*(?:[->] )?(?:📍\s*)?(?:\*\*)?Magasin:(?:\*\*)?\s*(.+)$/);
      const priceMatch = detailLine.match(/^\s*(?:[->] )?(?:💵\s*)?(?:\*\*)?Prix:(?:\*\*)?\s*(.+)$/);
      if (storeMatch) store_name = storeMatch[1]!.trim();
      if (priceMatch) price = priceMatch[1]!.trim();
    }

    const shouldBeChecked = checkedKeys.has(rowKey({ item_name: task.item_name, store_name, price }));
    nextLines[i] = (lines[i] ?? '').replace(/^(\s*>\s*)?- \[[ xX]\]/, `$1- [${shouldBeChecked ? 'x' : ' '}]`);
  }

  const nextText = nextLines.join('\n');
  const currentText = readFileSync(pickerPath, 'utf-8');
  if (nextText !== currentText) {
    writeFileSync(pickerPath, nextText, 'utf-8');
  }
}

function weekLabelFromDir(weekDir: string): string {
  return basename(weekDir).replace(/^Semaine du\s+/i, '');
}

function buildFinalList(items: PickerItem[], weekDir: string): string {
  const weekLabel = weekLabelFromDir(weekDir);
  const byStore = new Map<string, PickerItem[]>();
  for (const item of items) {
    if (!byStore.has(item.store_name)) byStore.set(item.store_name, []);
    byStore.get(item.store_name)!.push(item);
  }

  const lines: string[] = [];
  lines.push(obsidianFrontmatter(`Liste finale — ${weekLabel}`, 'final').trimEnd());
  lines.push(`# 🧾 Liste finale — ${weekLabel}`);
  lines.push('');

  if (items.length === 0) {
    lines.push('Aucun item sélectionné pour le moment.');
    lines.push('');
    lines.push(`Coche des items dans \`${PICKER_FILE}\`.`);
    lines.push('Ce fichier se met à jour automatiquement et regroupe les choix par magasin.');
    return lines.join('\n');
  }

  for (const [store, storeItems] of [...byStore.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'))) {
    lines.push(`## ${store}`);
    lines.push('');
    for (const item of storeItems) {
      lines.push(`- [ ] **${item.item_name}** — ${item.price}`);
    }
    lines.push('');
  }

  lines.push('Pour enlever un item, coche sa case ici. Il disparaîtra de la liste finale.');

  return lines.join('\n');
}

export function buildAndWriteFinalList(weekDir: string, changedPathArg?: string): string {
  const pickerItems = loadPickerItems(weekDir);
  const sourcePath = changedPathArg && ([...PICKER_FILE_NAMES, ...FINAL_LIST_FILE_NAMES].some(name => changedPathArg.endsWith(name)))
    ? (changedPathArg.startsWith('/') ? changedPathArg : join(weekDir, changedPathArg))
    : existingFile(weekDir, PICKER_FILE_NAMES);

  const pickerPath = existingFile(weekDir, PICKER_FILE_NAMES);
  const pickerCheckedKeys = new Set(loadCheckedIdsFromPath(pickerPath));
  let checkedKeys = pickerCheckedKeys;

  if (FINAL_LIST_FILE_NAMES.some(name => sourcePath.endsWith(name))) {
    const removalKeys = new Set(loadCheckedIdsFromPath(sourcePath));
    checkedKeys = new Set([...pickerCheckedKeys].filter(key => !removalKeys.has(key)));
    synchronizePickerFromFinalList(weekDir, checkedKeys);
  } else {
    checkedKeys = new Set(loadCheckedIdsFromPath(sourcePath));
  }

  const selected = pickerItems.filter(item => checkedKeys.has(selectedKeyForItem(item)));
  const output = buildFinalList(selected, weekDir);
  const outPath = join(weekDir, FINAL_LIST);
  writeFileSync(outPath, output, 'utf-8');
  return outPath;
}

function main(): void {
  const weekDir = process.argv[2] ? process.argv[2]! : latestWeekDir();
  const changedPathArg = process.argv[3];
  const outPath = buildAndWriteFinalList(weekDir, changedPathArg);
  console.log(`✅ Liste finale générée: ${outPath}`);
}

if (process.argv[1] && process.argv[1] === __filename) {
  main();
}
