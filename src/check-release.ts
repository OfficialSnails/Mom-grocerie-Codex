import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Include untracked release files locally, while respecting the project's ignored secrets/caches.
const files = [...new Set(execFileSync('git', ['ls-files', '-c', '-o', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean))];
let jsonCount = 0;
let jsCount = 0;
const failures: string[] = [];
for (const file of files) {
  const content = readFileSync(file);
  if (!content.includes(0) && /^(?:<{7}(?: |$)|={7}$|>{7}(?: |$))/m.test(content.toString('utf8'))) {
    failures.push(`Unresolved conflict marker: ${file}`);
  }
  if (file.endsWith('.json')) {
    try { JSON.parse(content.toString('utf8')); jsonCount++; }
    catch { failures.push(`Invalid JSON: ${file}`); }
  }
  if (file.startsWith('website/') && file.endsWith('.js')) {
    try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); jsCount++; }
    catch { failures.push(`Invalid JavaScript: ${file}`); }
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Release preflight passed: ${files.length} files scanned, ${jsonCount} JSON files parsed, ${jsCount} browser scripts checked.`);
}
