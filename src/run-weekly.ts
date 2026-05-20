import 'dotenv/config';
import { collectCurrentDeals } from './collect-current-deals.js';
import { generateReport } from './generate-report.js';
import { updateHistory, persistScoredDeals } from './update-history.js';
import { installObsidianStyle } from './obsidian-style.js';
import { readFileSync, existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORES_PATH = join(__dirname, '..', 'data', 'stores.json');
const REPORTS_DIR = join(__dirname, '..', 'reports');
const MOM_DIR = join(REPORTS_DIR, 'mom-list');
const HISTORICAL_DIR = join(REPORTS_DIR, 'historical-item');
const OBSIDIAN_MOM_ROOT = '/Users/slugz/Library/CloudStorage/Dropbox/OTHERS/OBSIDIAN MD';
const OBSIDIAN_WEEKLY_ROOT = join(OBSIDIAN_MOM_ROOT, 'Bons speciaux');
const WATCHER_PID_PATH = join(__dirname, '..', '.shopping-picker-watcher.pid');
const TSX_BIN = join(__dirname, '..', 'node_modules', '.bin', 'tsx');

interface StoreConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority_order: number;
}

function loadStores(): StoreConfig[] {
  if (!existsSync(STORES_PATH)) return [];
  return (JSON.parse(readFileSync(STORES_PATH, 'utf-8')) as StoreConfig[])
    .filter(s => s.enabled)
    .sort((a, b) => a.priority_order - b.priority_order);
}

function exportWeeklyPackToObsidian(weeklyPackDir: string): string {
  mkdirSync(OBSIDIAN_WEEKLY_ROOT, { recursive: true });
  const weekFolderName = basename(weeklyPackDir);
  const targetDir = join(OBSIDIAN_WEEKLY_ROOT, weekFolderName);
  rmSync(targetDir, { recursive: true, force: true });
  cpSync(weeklyPackDir, targetDir, { recursive: true });
  return targetDir;
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopExistingWatcher(): void {
  if (existsSync(WATCHER_PID_PATH)) {
    const raw = readFileSync(WATCHER_PID_PATH, 'utf-8').trim();
    const pid = Number(raw);
    if (Number.isFinite(pid) && pid > 0 && isProcessRunning(pid)) {
      try {
        process.kill(pid);
      } catch {
        // Ignore stale or already-terminated watcher processes.
      }
    }
    rmSync(WATCHER_PID_PATH, { force: true });
  }

  try {
    execFileSync('pkill', ['-f', 'src/watch-shopping-picker.ts'], { stdio: 'ignore' });
  } catch {
    // No watcher was running.
  }
}

function ensurePickerWatcher(): void {
  if (existsSync(WATCHER_PID_PATH)) {
    const raw = readFileSync(WATCHER_PID_PATH, 'utf-8').trim();
    const pid = Number(raw);
    if (Number.isFinite(pid) && pid > 0 && isProcessRunning(pid)) return;
  }

  const child = spawn(TSX_BIN, ['src/watch-shopping-picker.ts'], {
    cwd: join(__dirname, '..'),
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  child.unref();
}

function applyForcedRunDateFromEnv(): void {
  const raw = process.env.BONS_SPECIAUX_RUN_DATE;
  if (!raw) return;

  const fixedDate = new Date(raw);
  if (Number.isNaN(fixedDate.getTime())) {
    console.error(`❌ BONS_SPECIAUX_RUN_DATE invalide: ${raw}`);
    console.error('   Exemple: BONS_SPECIAUX_RUN_DATE=2026-05-21T12:00:00-04:00 npm run weekly');
    process.exit(1);
  }

  const RealDate = Date;
  const fixedTime = fixedDate.getTime();

  const MockDate = class extends RealDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(fixedTime);
      } else if (args.length === 1) {
        super(args[0]);
      } else if (args.length === 2) {
        super(args[0], args[1]);
      } else if (args.length === 3) {
        super(args[0], args[1], args[2]);
      } else if (args.length === 4) {
        super(args[0], args[1], args[2], args[3]);
      } else if (args.length === 5) {
        super(args[0], args[1], args[2], args[3], args[4]);
      } else if (args.length === 6) {
        super(args[0], args[1], args[2], args[3], args[4], args[5]);
      } else {
        super(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
      }
    }

    static now(): number {
      return fixedTime;
    }

    static parse(value: string): number {
      return RealDate.parse(value);
    }

    static UTC(...args: any[]): number {
      return Reflect.apply(RealDate.UTC, RealDate, args) as number;
    }
  };

  globalThis.Date = MockDate as DateConstructor;
  console.log(`🗓️ Date d'exécution forcée: ${fixedDate.toISOString()} (BONS_SPECIAUX_RUN_DATE)`);
}

async function main() {
  applyForcedRunDateFromEnv();

  console.log('');
  console.log('🥦 Bons spéciaux — démarrage du rapport hebdomadaire');
  console.log('');

  const stores = loadStores();
  if (stores.length === 0) {
    console.error('❌ Aucun magasin activé dans data/stores.json');
    process.exit(1);
  }

  console.log(`📍 Magasins configurés (${stores.length}):`);
  for (const store of stores) {
    console.log(`   ${store.priority_order}. ${store.name}`);
  }
  console.log('');

  // Step 1: Collect deals
  console.log('📥 Collecte des spéciaux...');
  const { items, usedMock, skippedAdapters, sourceSummary, hasLiveFlyerData } = await collectCurrentDeals();

  if (usedMock) {
    console.log('   ⚠️  Données de démonstration utilisées (aucune source réelle activée)');
  } else {
    console.log(`   ✅ ${items.length} articles collectés depuis les sources activées`);
  }
  console.log(`   📦 Répartition: ${Object.entries(sourceSummary).map(([id, count]) => `${id}=${count}`).join(', ') || 'aucune'}`);

  if (skippedAdapters.length > 0) {
    console.log('');
    console.log('   Sources ignorées (désactivées ou en attente de vérification):');
    for (const id of skippedAdapters) {
      const reason = id.includes('firecrawl')
        ? 'À activer dans source_status.json après vérification'
        : 'Désactivé';
      console.log(`   - ${id}: ${reason}`);
    }
  }

  console.log('');

  // Step 2: Generate report (scores internally, returns scored deals for history)
  console.log('📝 Génération du rapport...');
  const dateStr = new Date().toISOString().slice(0, 10);
  const liveMomPath = join(MOM_DIR, `bons-speciaux-joliette-${dateStr}-top20.md`);
  const liveFullPath = join(HISTORICAL_DIR, `bons-speciaux-joliette-${dateStr}-complet.md`);
  const shouldProtectLiveReports = !hasLiveFlyerData && (existsSync(liveMomPath) || existsSync(liveFullPath));
  const reportVariant = usedMock
    ? 'mock-preview'
    : hasLiveFlyerData
      ? 'live'
      : 'manual-preview';

  if (shouldProtectLiveReports) {
    console.log('   ⚠️  Aucune donnée circulaire live détectée.');
    console.log('   ⚠️  Les rapports du jour existants sont protégés contre un écrasement par un run CSV/manual-only.');
  }

  const {
    filepath,
    momFilepath,
    auditFilepath,
    verifiedMomFilepath,
    comparisonFilepath,
    rawFilepath,
    verifiedJsonFilepath,
    shoppingListFilepath,
    storeSummaryFilepath,
    weeklyPackDir,
    scored,
  } = await generateReport(items, { reportVariant });

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ Rapports générés avec succès!');
  console.log('');
  console.log(`📁 Dossier de la semaine : ${weeklyPackDir}`);
  console.log(`🛒 Liste à ouvrir : ${shoppingListFilepath}`);
  console.log(`🏬 Résumé par magasin : ${storeSummaryFilepath}`);
  console.log('');
  console.log('Fichiers détaillés:');
  console.log(`📋 Ancienne liste par magasin : ${momFilepath}`);
  console.log(`🧾 Liste vérifiée : ${verifiedMomFilepath}`);
  console.log(`📄 Complet (historique) : ${filepath}`);
  console.log(`🔎 Audit JSON : ${auditFilepath}`);
  console.log(`📦 Snapshot brut : ${rawFilepath}`);
  console.log(`✅ Shortlist vérifiée JSON : ${verifiedJsonFilepath}`);
  console.log(`🆚 Comparaison : ${comparisonFilepath}`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // Step 3: Export weekly pack into Obsidian
  console.log('🗂️ Export vers Obsidian...');
  try {
    const exportedDir = exportWeeklyPackToObsidian(weeklyPackDir);
    installObsidianStyle(OBSIDIAN_MOM_ROOT);
    stopExistingWatcher();
    ensurePickerWatcher();
    console.log(`   ✅ Dossier exporté: ${exportedDir}`);
    console.log('   ✅ Synchronisation automatique des cases activée');
  } catch (err) {
    console.warn('⚠️  Export Obsidian échoué:', err instanceof Error ? err.message : String(err));
  }
  console.log('');

  // Step 4: Persist all collected prices to history (builds the 6-month database)
  console.log('📚 Mise à jour de l\'historique des prix...');
  try {
    persistScoredDeals(scored);
    updateHistory(); // also picks up any manual CSV entries
  } catch (err) {
    console.warn('⚠️  Mise à jour de l\'historique échouée:', err instanceof Error ? err.message : String(err));
  }

  if (!hasLiveFlyerData) {
    console.log('💡 Vérification requise avant usage:');
    console.log('   1. Le run actuel ne contient pas de collecte circulaire live vérifiable.');
    console.log('   2. Utilise plutôt le rapport *-manual-preview ou *-mock-preview pour analyse interne.');
    console.log('   3. Ne donne pas cette version à ta mère comme liste finale sans validation source.');
    console.log('');
  }
}

main().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
