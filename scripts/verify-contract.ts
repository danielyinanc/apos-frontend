import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import {
  DEFAULT_IGNORED_POINTERS,
  diffJson,
  formatDiff,
  parseOpenApi,
  readPin,
  readVendoredContract,
} from './lib/contract.ts';

const { values } = parseArgs({
  options: {
    backend: { type: 'string' },
    wait: { type: 'string', default: '0' },
    strict: { type: 'boolean', default: false },
  },
});

const base =
  values.backend ??
  process.env['APOS_BACKEND_URL'] ??
  process.env['BACKEND_URL'] ??
  'http://localhost:8000';

const healthUrl = new URL('/healthz', base).toString();
const specUrl = new URL('/openapi.json', base).toString();

const attempts = Math.max(1, Math.ceil(Number(values.wait) / 5));
let health: { status?: string; version?: string; packs?: unknown } | undefined;

for (let i = 0; i < attempts; i += 1) {
  try {
    const res = await fetch(healthUrl);
    if (res.ok) {
      health = (await res.json()) as typeof health;
      break;
    }
  } catch {
    /* not up yet */
  }
  if (i < attempts - 1) await sleep(5000);
}

if (!health) {
  console.error(`No backend at ${healthUrl}.`);
  console.error(
    'Start one, or point at it:  pnpm verify:contract --backend http://host:8000 --wait 60',
  );
  process.exit(2);
}

const res = await fetch(specUrl);
if (!res.ok) {
  console.error(`GET ${specUrl} -> ${res.status}`);
  process.exit(2);
}

const live = parseOpenApi(await res.text(), specUrl);
const pinned = await readVendoredContract();
const pin = await readPin();

const ignored = values.strict ? [] : [...DEFAULT_IGNORED_POINTERS];
const diffs = diffJson(pinned, live, ignored);

console.log(`pinned:  ${pin} (contract/openapi.json)`);
console.log(`live:    ${specUrl}  version=${health.version ?? '?'}`);
if (!values.strict) console.log(`ignored: ${ignored.join(', ')}  (pass --strict to include)`);

if (diffs.length === 0) {
  console.log('\nOK: the running backend matches the pinned contract.');
  process.exit(0);
}

console.error(
  `\nFAIL: ${diffs.length} difference(s) between the pinned contract and the live backend.\n`,
);
console.error(formatDiff(diffs));
console.error('\nIf the backend is right, bump the pin:');
console.error(`  echo <backend-vX.Y.Z> > backend-version.txt && pnpm contract:sync`);
console.error('Or, for a local backend:');
console.error(`  pnpm contract:pull --from-backend ${base} && pnpm generate:types`);
process.exit(1);
