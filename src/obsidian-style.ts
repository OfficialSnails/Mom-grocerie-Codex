import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SNIPPET_NAME = 'bons-speciaux';

const CSS = `
.markdown-preview-view.bons-speciaux,
.markdown-source-view.mod-cm6.bons-speciaux {
  --bons-ink: #202124;
  --bons-muted: #667085;
  --bons-line: #e6e8ec;
  --bons-soft: #f7f8f6;
  --bons-card: #ffffff;
  --bons-accent: #2f6f4e;
  --bons-price: #8a4b13;
}

.markdown-preview-view.bons-speciaux h1 {
  border-bottom: 1px solid var(--bons-line);
  padding-bottom: 0.45em;
  margin-bottom: 0.7em;
}

.markdown-preview-view.bons-speciaux h2 {
  margin-top: 1.35em;
  padding: 0.55em 0.75em;
  border: 1px solid var(--bons-line);
  border-left: 5px solid var(--bons-accent);
  border-radius: 10px;
  background: linear-gradient(90deg, #f3f7f1 0%, #ffffff 78%);
}

.markdown-preview-view.bons-speciaux ul.contains-task-list {
  padding-inline-start: 0;
}

.markdown-preview-view.bons-speciaux li.task-list-item {
  list-style: none;
  margin: 0.9em 0 1.15em;
  padding: 0.75em 0.85em;
  border: 1px solid var(--bons-line);
  border-radius: 12px;
  background: var(--bons-card);
  box-shadow: 0 1px 0 rgba(16, 24, 40, 0.04);
}

.markdown-preview-view.bons-speciaux li.task-list-item > p,
.markdown-preview-view.bons-speciaux li.task-list-item > div {
  margin-block-start: 0;
}

.markdown-preview-view.bons-speciaux input.task-list-item-checkbox {
  margin-inline-end: 0.55em;
  transform: scale(1.12);
}

.markdown-preview-view.bons-speciaux blockquote {
  margin: 0.55em 0 0.65em 1.65em;
  padding: 0.58em 0.75em;
  border-left: 4px solid #c9d8cb;
  border-radius: 10px;
  background: var(--bons-soft);
  color: var(--bons-ink);
}

.markdown-preview-view.bons-speciaux blockquote p {
  margin: 0.18em 0;
}

.markdown-preview-view.bons-speciaux strong {
  color: var(--bons-ink);
}

.markdown-preview-view.bons-speciaux img {
  max-width: min(230px, 100%);
  border-radius: 10px;
  border: 1px solid var(--bons-line);
  box-shadow: 0 2px 12px rgba(16, 24, 40, 0.08);
}

.markdown-preview-view.bons-speciaux .callout[data-callout="info"] {
  border: 1px solid var(--bons-line);
  border-left: 5px solid var(--bons-accent);
  border-radius: 14px;
  background: #ffffff;
  overflow: hidden;
}

.markdown-preview-view.bons-speciaux .callout[data-callout="info"] .callout-title {
  padding: 0.18em 0;
  font-size: 1.12em;
  font-weight: 750;
}

.markdown-preview-view.bons-speciaux .callout[data-callout="info"] .callout-content {
  padding-top: 0.4em;
}
`.trim();

export function obsidianFrontmatter(title: string, view: string): string {
  return [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    'tags:',
    '  - bons-speciaux',
    'cssclasses:',
    '  - bons-speciaux',
    `  - bons-${view}`,
    '---',
    '',
  ].join('\n');
}

export function installObsidianStyle(obsidianVaultRoot: string): void {
  const obsidianDir = join(obsidianVaultRoot, '.obsidian');
  const snippetsDir = join(obsidianDir, 'snippets');
  mkdirSync(snippetsDir, { recursive: true });
  writeFileSync(join(snippetsDir, `${SNIPPET_NAME}.css`), CSS + '\n', 'utf-8');

  const appearancePath = join(obsidianDir, 'appearance.json');
  let appearance: Record<string, unknown> = {};
  if (existsSync(appearancePath)) {
    try {
      appearance = JSON.parse(readFileSync(appearancePath, 'utf-8')) as Record<string, unknown>;
    } catch {
      appearance = {};
    }
  }

  const enabled = Array.isArray(appearance.enabledCssSnippets)
    ? appearance.enabledCssSnippets.filter((item): item is string => typeof item === 'string')
    : [];

  if (!enabled.includes(SNIPPET_NAME)) enabled.push(SNIPPET_NAME);
  appearance.enabledCssSnippets = enabled;
  writeFileSync(appearancePath, JSON.stringify(appearance, null, 2) + '\n', 'utf-8');
}
