import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './lib/contract.ts';

// Schema-driven rendering enforcement: a new backend pack must light up with
// zero frontend changes. Hardcoding pack/domain vocabulary in components is a
// defect. The regime tone map is the one legitimate place a value literal
// belongs (it maps unknown values to a neutral default, it does not branch on
// a pack id), so it is allowlisted explicitly.
const FORBIDDEN = /\b(mbs|equity|Duration|OAS|CPR|TBA|REIT)\b/;
const ALLOWLIST = new Set(['src/lib/format/regime.ts']);
const SCAN_DIRS = ['src/components', 'src/app'];

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) yield full;
  }
}

const violations: string[] = [];
for (const dir of SCAN_DIRS) {
  for await (const file of walk(path.join(ROOT, dir))) {
    const rel = path.relative(ROOT, file);
    if (ALLOWLIST.has(rel)) continue;
    const text = await readFile(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (FORBIDDEN.test(line) && !line.trim().startsWith('//')) {
        violations.push(`${rel}:${i + 1}: ${line.trim()}`);
      }
    });
  }
}

if (violations.length > 0) {
  console.error('Pack-specific literals found outside the allowlist (schema-driven violation):');
  violations.forEach((v) => console.error(`  ${v}`));
  process.exit(1);
}
console.log('No forbidden pack-specific literals found.');
