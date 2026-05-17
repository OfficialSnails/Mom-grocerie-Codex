import { existsSync, writeFileSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildAndWriteFinalList } from './build-final-list.js';
import { FINAL_LIST_FILE, LEGACY_FINAL_LIST_FILES, LEGACY_PICKER_FILES, LEGACY_TECHNICAL_DIRS, PICKER_FILE, TECHNICAL_DIR } from './weekly-files.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const OBSIDIAN_ROOT = '/Users/slugz/Library/CloudStorage/Dropbox/OTHERS/OBSIDIAN MD/Bons speciaux';
const PID_PATH = join(PROJECT_ROOT, '.shopping-picker-watcher.pid');
const POLL_MS = 1000;
const PICKER_FILES = [PICKER_FILE, FINAL_LIST_FILE, ...LEGACY_PICKER_FILES, ...LEGACY_FINAL_LIST_FILES] as const;

function latestWeekDirs(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(root, entry.name));
}

function fileSignature(path: string): string | null {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

function hasPickerItems(weekDir: string): boolean {
  return [TECHNICAL_DIR, ...LEGACY_TECHNICAL_DIRS].some(dirname => existsSync(join(weekDir, dirname, 'picker-items.json')));
}

const inFlight = new Set<string>();
const pending = new Map<string, string>();

function finalizeWeekDir(weekDir: string, sourcePath: string): void {
  if (!hasPickerItems(weekDir)) return;

  if (inFlight.has(weekDir)) {
    pending.set(weekDir, sourcePath);
    return;
  }

  inFlight.add(weekDir);
  try {
    buildAndWriteFinalList(weekDir, sourcePath);
  } catch (err) {
    console.error(`[watch-picker] ${weekDir}: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    inFlight.delete(weekDir);
    const nextSource = pending.get(weekDir);
    if (nextSource) {
      pending.delete(weekDir);
      finalizeWeekDir(weekDir, nextSource);
    }
  }
}

function main(): void {
  writeFileSync(PID_PATH, String(process.pid), 'utf-8');
  const known = new Map<string, string>();

  const poll = () => {
    const currentPaths = new Set<string>();

    for (const weekDir of latestWeekDirs(OBSIDIAN_ROOT)) {
      if (!hasPickerItems(weekDir)) continue;

      for (const filename of PICKER_FILES) {
        const path = join(weekDir, filename);
        const signature = fileSignature(path);
        if (!signature) continue;

        currentPaths.add(path);
        const previous = known.get(path);
        if (!previous) {
          known.set(path, signature);
          continue;
        }

        if (previous !== signature) {
          known.set(path, signature);
          finalizeWeekDir(weekDir, path);
        }
      }
    }

    for (const path of [...known.keys()]) {
      if (!currentPaths.has(path)) {
        known.delete(path);
      }
    }
  };

  poll();
  setInterval(poll, POLL_MS);
}

main();
