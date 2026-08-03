import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PIN_PATH = path.join(ROOT, 'backend-version.txt');
export const CONTRACT_PATH = path.join(ROOT, 'contract', 'openapi.json');
export const TYPES_PATH = path.join(ROOT, 'src', 'types', 'api.d.ts');

export const BACKEND_REPO = 'danielyinanc/apos-backend';
export const UNPINNED = 'unpinned';

/** Pointers whose value is expected to differ between a release and a dev server. */
export const DEFAULT_IGNORED_POINTERS = ['/info/version', '/servers'] as const;

const TAG_RE = /^backend-v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export async function readPin(): Promise<string> {
  const raw = (await readFile(PIN_PATH, 'utf8')).trim();
  if (raw !== UNPINNED && !TAG_RE.test(raw)) {
    throw new Error(
      `backend-version.txt must contain "${UNPINNED}" or a tag like "backend-v1.2.3"; got ${JSON.stringify(raw)}`,
    );
  }
  return raw;
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Recursively sort object keys by UTF-16 code unit. Array order is PRESERVED:
 * `required`, `enum`, `parameters` and `tags` are semantically ordered in
 * OpenAPI, so a reordering there is a real change worth a diff.
 */
export function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      out[key] = canonicalise(value[key]);
    }
    return out;
  }
  return value;
}

/** The one true on-disk representation. Two spaces, trailing newline, LF. */
export function serialise(value: unknown): string {
  return `${JSON.stringify(canonicalise(value), null, 2)}\n`;
}

export function parseOpenApi(text: string, source: string): Record<string, unknown> {
  let doc: unknown;
  try {
    doc = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (cause) {
    throw new Error(`${source} is not valid JSON`, { cause });
  }
  if (!isPlainObject(doc) || typeof doc['openapi'] !== 'string' || !isPlainObject(doc['paths'])) {
    throw new Error(`${source} does not look like an OpenAPI document (no "openapi"/"paths")`);
  }
  return doc;
}

export async function readVendoredContract(): Promise<Record<string, unknown>> {
  return parseOpenApi(await readFile(CONTRACT_PATH, 'utf8'), CONTRACT_PATH);
}

// ---------------------------------------------------------------- diffing

export type Difference =
  | { kind: 'added'; pointer: string; right: unknown }
  | { kind: 'removed'; pointer: string; left: unknown }
  | { kind: 'changed'; pointer: string; left: unknown; right: unknown };

const escape = (k: string) => k.replaceAll('~', '~0').replaceAll('/', '~1');

export function diffJson(
  left: unknown,
  right: unknown,
  ignored: readonly string[] = [],
): Difference[] {
  const out: Difference[] = [];
  const skip = new Set(ignored);

  const walk = (pointer: string, l: unknown, r: unknown): void => {
    if (skip.has(pointer)) return;

    if (isPlainObject(l) && isPlainObject(r)) {
      for (const key of new Set([...Object.keys(l), ...Object.keys(r)])) {
        const p = `${pointer}/${escape(key)}`;
        if (skip.has(p)) continue;
        if (!(key in l)) out.push({ kind: 'added', pointer: p, right: r[key] });
        else if (!(key in r)) out.push({ kind: 'removed', pointer: p, left: l[key] });
        else walk(p, l[key], r[key]);
      }
      return;
    }

    if (Array.isArray(l) && Array.isArray(r)) {
      for (let i = 0; i < Math.max(l.length, r.length); i += 1) {
        const p = `${pointer}/${i}`;
        if (i >= l.length) out.push({ kind: 'added', pointer: p, right: r[i] });
        else if (i >= r.length) out.push({ kind: 'removed', pointer: p, left: l[i] });
        else walk(p, l[i], r[i]);
      }
      return;
    }

    if (JSON.stringify(l) !== JSON.stringify(r)) {
      out.push({ kind: 'changed', pointer: pointer || '/', left: l, right: r });
    }
  };

  walk('', canonicalise(left), canonicalise(right));
  return out;
}

const preview = (v: unknown): string => {
  const s = typeof v === 'string' ? JSON.stringify(v) : (JSON.stringify(v) ?? String(v));
  return s.length > 140 ? `${s.slice(0, 137)}...` : s;
};

export function formatDiff(diffs: readonly Difference[], limit = 60): string {
  const lines = diffs.slice(0, limit).map((d) => {
    if (d.kind === 'added') return `  + ${d.pointer}   ${preview(d.right)}`;
    if (d.kind === 'removed') return `  - ${d.pointer}   ${preview(d.left)}`;
    return `  ~ ${d.pointer}\n      pinned: ${preview(d.left)}\n      live:   ${preview(d.right)}`;
  });
  if (diffs.length > limit) lines.push(`  ... and ${diffs.length - limit} more difference(s)`);
  return lines.join('\n');
}
