import { execFileSync } from 'node:child_process';

const API = 'https://api.github.com';

export function resolveToken(): string | undefined {
  const fromEnv = process.env['GITHUB_TOKEN'] ?? process.env['GH_TOKEN'];
  if (fromEnv) return fromEnv;
  try {
    const token = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return token || undefined;
  } catch {
    return undefined;
  }
}

function headers(token: string | undefined, accept: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'apos-frontend-contract-sync',
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

function explain(status: number, repo: string, hasToken: boolean): string {
  if (status === 404 && !hasToken) {
    return `404 from ${repo}. If the repo is private, set GITHUB_TOKEN (or run \`gh auth login\`). In CI use a PAT with contents:read on ${repo}; the workflow's own GITHUB_TOKEN cannot read another repository.`;
  }
  if (status === 401 || status === 403) {
    return `${status} from ${repo}: the token is missing, expired, or lacks contents:read.`;
  }
  return `${status} from ${repo}.`;
}

export async function fetchReleaseAsset(
  repo: string,
  tag: string,
  assetName: string,
): Promise<string> {
  const token = resolveToken();

  const relRes = await fetch(`${API}/repos/${repo}/releases/tags/${tag}`, {
    headers: headers(token, 'application/vnd.github+json'),
  });
  if (!relRes.ok) {
    throw new Error(`Cannot read release ${tag}: ${explain(relRes.status, repo, Boolean(token))}`);
  }

  const release = (await relRes.json()) as { assets?: { id: number; name: string }[] };
  const asset = release.assets?.find((a) => a.name === assetName);
  if (!asset) {
    const names = release.assets?.map((a) => a.name).join(', ') || '(none)';
    throw new Error(`Release ${tag} has no asset named "${assetName}". Assets: ${names}`);
  }

  const assetRes = await fetch(`${API}/repos/${repo}/releases/assets/${asset.id}`, {
    headers: headers(token, 'application/octet-stream'),
  });
  if (!assetRes.ok) {
    throw new Error(
      `Cannot download ${assetName}: ${explain(assetRes.status, repo, Boolean(token))}`,
    );
  }
  return assetRes.text();
}
