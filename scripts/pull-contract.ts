import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs, promisify } from 'node:util';
import {
  BACKEND_REPO,
  CONTRACT_PATH,
  UNPINNED,
  parseOpenApi,
  readPin,
  serialise,
} from './lib/contract.ts';
import { fetchReleaseAsset } from './lib/github.ts';

const execFileAsync = promisify(execFile);

const { values } = parseArgs({
  options: {
    'from-file': { type: 'string' },
    'from-docker': { type: 'string' },
    'from-backend': { type: 'string' },
    'from-url': { type: 'string' },
  },
});

async function load(): Promise<{ text: string; source: string }> {
  const file = values['from-file'] ?? process.env['APOS_OPENAPI_FILE'];
  if (file) return { text: await readFile(file, 'utf8'), source: `file ${file}` };

  const image = values['from-docker'];
  if (image) {
    const { stdout } = await execFileAsync('docker', ['run', '--rm', image, 'openapi'], {
      maxBuffer: 64 * 1024 * 1024,
    });
    return { text: stdout, source: `docker image ${image}` };
  }

  const backend = values['from-backend'];
  if (backend) {
    const url = new URL('/openapi.json', backend).toString();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    return { text: await res.text(), source: url };
  }

  const url = values['from-url'] ?? process.env['APOS_OPENAPI_URL'];
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    return { text: await res.text(), source: url };
  }

  const pin = await readPin();
  if (pin === UNPINNED) {
    throw new Error(
      [
        'backend-version.txt is "unpinned" and no source was given.',
        'No apos-backend release exists yet, so pick a bootstrap source:',
        '  pnpm contract:pull --from-docker apos-backend:dev',
        '  pnpm contract:pull --from-backend http://localhost:8000',
        '  pnpm contract:pull --from-file ./openapi.json',
        'Once backend-v0.1.0 is released, write it to backend-version.txt and run `pnpm contract:sync`.',
      ].join('\n'),
    );
  }
  return {
    text: await fetchReleaseAsset(BACKEND_REPO, pin, 'openapi.json'),
    source: `${BACKEND_REPO} release ${pin}`,
  };
}

const { text, source } = await load();
const doc = parseOpenApi(text, source);
const before = await readFile(CONTRACT_PATH, 'utf8').catch(() => '');
const after = serialise(doc);

if (before === after) {
  console.log(`contract/openapi.json already matches ${source}.`);
} else {
  await writeFile(CONTRACT_PATH, after);
  console.log(`contract/openapi.json updated from ${source}.`);
  console.log('Next: pnpm generate:types');
}
