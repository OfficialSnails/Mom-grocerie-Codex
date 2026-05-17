import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATUS_PATH = join(__dirname, '..', 'data', 'source_status.json');

interface SourceStatus {
  source_id: string;
  store_id: string;
  enabled: boolean;
  collection_method: string;
  robots_status: string;
  terms_status: string;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  notes: string;
}

interface StatusFile {
  sources: SourceStatus[];
}

function loadStatus(): StatusFile {
  if (!existsSync(STATUS_PATH)) return { sources: [] };
  return JSON.parse(readFileSync(STATUS_PATH, 'utf-8')) as StatusFile;
}

function saveStatus(data: StatusFile): void {
  writeFileSync(STATUS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function isSourceAllowed(sourceId: string): boolean {
  const data = loadStatus();
  const status = data.sources.find(s => s.source_id === sourceId);
  if (!status) return false;
  if (!status.enabled) return false;
  if (status.robots_status === 'disallowed') return false;
  if (status.terms_status === 'disallowed') return false;
  return true;
}

export function updateSourceStatus(sourceId: string, success: boolean, error?: string): void {
  const data = loadStatus();
  const idx = data.sources.findIndex(s => s.source_id === sourceId);
  if (idx === -1) return;

  const now = new Date().toISOString();
  data.sources[idx].last_checked_at = now;

  if (success) {
    data.sources[idx].last_success_at = now;
    data.sources[idx].last_error = null;
  } else {
    data.sources[idx].last_error = error ?? 'Erreur inconnue';
  }

  saveStatus(data);
}

export function logSkippedSource(sourceId: string, reason: string): void {
  console.log(`[source-safety] Source ignorée "${sourceId}": ${reason}`);
}

export function getSkippedSources(): string[] {
  const data = loadStatus();
  return data.sources
    .filter(s => !s.enabled || s.robots_status === 'disallowed' || s.terms_status === 'disallowed')
    .filter(s => s.collection_method === 'firecrawl')
    .map(s => s.source_id);
}

export function getEnabledFirecrawlSources(): SourceStatus[] {
  const data = loadStatus();
  return data.sources.filter(
    s => s.enabled && s.collection_method === 'firecrawl' &&
    s.robots_status !== 'disallowed' && s.terms_status !== 'disallowed'
  );
}
