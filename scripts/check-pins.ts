import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './lib/contract.ts';

const fail: string[] = [];

const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8')) as {
  packageManager?: string;
  engines?: { node?: string };
};

const pm = pkg.packageManager ?? '';
const m = /^pnpm@(\d+\.\d+\.\d+)(\+sha512\.[0-9a-f]+)?$/.exec(pm);
if (!m) fail.push(`package.json packageManager is not "pnpm@x.y.z": ${JSON.stringify(pm)}`);
const pnpmVersion = m?.[1];

const dockerfile = await readFile(path.join(ROOT, 'Dockerfile'), 'utf8');
const argPnpm = /^ARG PNPM_VERSION=(\S+)$/m.exec(dockerfile)?.[1];
if (argPnpm !== pnpmVersion) {
  fail.push(
    `Dockerfile ARG PNPM_VERSION=${argPnpm} != package.json packageManager pnpm@${pnpmVersion}`,
  );
}

const nvmrc = (await readFile(path.join(ROOT, '.nvmrc'), 'utf8')).trim();
const argNode = /^ARG NODE_VERSION=(\S+)$/m.exec(dockerfile)?.[1];
if (argNode !== nvmrc) fail.push(`Dockerfile ARG NODE_VERSION=${argNode} != .nvmrc ${nvmrc}`);

if (!pkg.engines?.node?.includes(nvmrc.split('.')[0] ?? '')) {
  fail.push(`package.json engines.node (${pkg.engines?.node}) does not cover .nvmrc ${nvmrc}`);
}

if (fail.length > 0) {
  console.error('Version pins disagree:\n' + fail.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(`Pins agree: node ${nvmrc}, pnpm ${pnpmVersion}.`);
