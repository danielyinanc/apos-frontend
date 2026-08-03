# apos-frontend

The web UI for APOS (Advanced Portfolio Optimization System): a conversational copilot for
investment professionals. This repository is the source of truth for the Next.js App Router
application, the browser-facing BFF that holds the backend credential, and a _pinned,
committed_ TypeScript view of the apos-backend HTTP contract.

**100% TypeScript/Node. pnpm only, pinned through `packageManager` + corepack. No Python, no
uv, no npm or yarn lockfile, no JS package manager other than pnpm anywhere.** This is the
only repository in the system that contains JavaScript.

## Principles

1. The browser never talks to apos-backend directly. The backend has no CORS middleware, no
   login endpoint, and no tenant header — the bearer JWT lives only in the Node process,
   injected by Next.js route handlers.
2. The API contract is pinned, vendored, and committed. `pnpm build` and `pnpm test` work
   fully offline.
3. Generated files (`src/types/api.d.ts`) are committed, and CI regenerates them to prove
   they are current — a contract change shows up as a reviewable PR diff.
4. Every risk measure, regime axis, compliance rule, and capability is discovered at runtime
   from `GET /api/packs/active` and rendered generically. Hardcoding pack vocabulary
   ("Duration", "OAS", a fixed five-axis regime panel) is a defect, enforced in CI by
   `pnpm check:no-pack-literals`.
5. Misconfiguration is a boot failure, never a runtime 500 (`src/env/server.ts`).

## Repository layout

```
src/
  app/
    page.tsx                 the three-pane workspace
    api/
      chat/route.ts           BFF: proxies POST /api/chat/stream (SSE -> AI SDK stream)
      approve/route.ts        BFF: proxies POST /api/approve (SSE)
      approvals/modify/route.ts   composes "Modify" (backend has no native modify action)
      apos/[...path]/route.ts     whitelisted GET proxy for read routes
      threads/                local-only thread store (backend has no thread endpoint)
      healthz/route.ts
  lib/
    sse/            SSE framing, envelope zod schema, the envelope -> UI chunk translator
    ai/             AposUIMessage type (custom data parts), part-type guards
    server/         proxy-sse.ts (the shared BFF plumbing), thread-store.ts, env access
    format/         unit formatter registry, capability index, REST response zod schemas
    query/          TanStack Query hooks + keys + capability-kind-driven invalidation
    glossary/, modes/   provider seams for backend features that don't exist yet
  components/
    schema/         generic renderers: RiskMeasureList, RegimePanel, CapabilityStatusList...
    approval/        ApprovalCard, BlockedByCompliance -- the highest-stakes surface
    chat/, layout/
  stores/           Zustand: approval state machine, local UI state
  types/api.d.ts    GENERATED -- do not hand-edit
contract/openapi.json   vendored, canonicalised pinned contract
scripts/            contract pinning tooling (TypeScript, run via tsx)
tests/              MSW handlers, fixtures generated against the pinned OpenAPI types
```

Dependency direction:

```
browser --> Next.js route handlers (BFF, holds the JWT)
                   |
                   v
           apos-backend :8000   (Bearer HS256, no CORS, no login endpoint)

contract/openapi.json --(openapi-typescript)--> src/types/api.d.ts --> src/lib/api/*
        ^
        +-- pinned by backend-version.txt
```

## Getting started

```bash
corepack enable
pnpm install
cp .env.example .env.local   # fill in BACKEND_URL / APOS_API_TOKEN
pnpm dev
```

```bash
pnpm verify        # check:pins + typecheck + lint + format:check + test
pnpm build
```

## The backend contract

`backend-version.txt` pins an apos-backend release tag (`backend-vX.Y.Z`) or the literal
`unpinned`. `contract/openapi.json` is a canonicalised, committed copy of that release's
`openapi.json`. `src/types/api.d.ts` is generated from it and is also committed, so the repo
builds and tests fully offline.

**Important:** most of apos-backend's read routes return FastAPI `dict[str, Any]`, so their
generated OpenAPI types collapse to `{[key: string]: unknown}` — they carry no real shape.
For those routes (and for the entire SSE protocol, which isn't in OpenAPI at all since it's a
`StreamingResponse`), the contract lives in hand-written zod schemas
(`src/lib/format/schemas.ts`, `src/lib/sse/schema.ts`) validated at the BFF boundary on every
request. A schema violation on a _known_ event/field produces a visible notice, never a
silent drop or a crash — additive backend fields survive via `.passthrough()`.

### Bumping the pin

```bash
echo backend-v0.2.0 > backend-version.txt
pnpm contract:sync      # = contract:pull + generate:types
pnpm typecheck           # a breaking change surfaces here
```

`pnpm contract:pull` accepts an explicit source when no release exists yet or you want a
local backend's contract:

```bash
pnpm contract:pull --from-docker apos-backend:dev
pnpm contract:pull --from-backend http://localhost:8000
pnpm contract:pull --from-file ./openapi.json
```

`pnpm generate:types` never hits the network — it is a pure function of the vendored
`contract/openapi.json`. CI enforces this: it regenerates and runs
`git diff --exit-code`, so drift is a hard failure regardless of whether a backend release
has ever been published.

`pnpm verify:contract --backend http://localhost:8000 --wait 60` fetches `/openapi.json`
from a _running_ backend and diffs it against the vendored copy — useful for catching
"someone changed the backend but forgot to bump the pin" during development. In CI
(`ci / contract-live`), the same check runs against the pinned `ghcr.io` image; while
`backend-version.txt` is `unpinned` (no apos-backend release exists yet) this emits a
warning annotation and passes, and becomes an unconditional hard failure the moment a real
tag is pinned.

The `contract` workflow re-pins automatically: a `repository_dispatch` fires on every
apos-backend release (the backend already dispatches at this repo), and a weekday cron
catches anything missed, both opening a PR with the regenerated diff.

### Bootstrapping before any release exists

No apos-backend release or container image has been published yet as of this writing. The
vendored `contract/openapi.json` was generated by building the backend locally and running
its `openapi` CLI entrypoint:

```bash
# in an apos-backend checkout
docker build -f docker/Dockerfile -t apos-backend:dev .
docker run --rm apos-backend:dev openapi > /tmp/openapi.json

# in this repo
pnpm contract:pull --from-file /tmp/openapi.json
pnpm generate:types
```

## Operations

```bash
docker build -t apos-frontend .
docker run -p 3000:3000 \
  -e APOS_ENV=dev -e BACKEND_URL=http://host.docker.internal:8000 \
  -e APOS_API_TOKEN=<jwt> \
  apos-frontend
```

| Env var                   | Required             | Notes                                                             |
| ------------------------- | -------------------- | ----------------------------------------------------------------- |
| `BACKEND_URL`             | yes                  | apos-backend base URL. Must be `https://` outside `APOS_ENV=dev`. |
| `APOS_API_TOKEN`          | yes                  | Bearer JWT. The placeholder value is rejected outside `dev`.      |
| `APOS_ENV`                | no (default `dev`)   | `dev` \| `staging` \| `prod`                                      |
| `APOS_BACKEND_TIMEOUT_MS` | no (default `15000`) |                                                                   |
| `PORT`                    | no (default `3000`)  |                                                                   |

`GET /api/healthz` reports `{status, version, backend: {url, pinned}}`. Ports already taken
elsewhere in the system: `8000` (backend API), `9001` (MCP stub), `5433` (Postgres) — this
app takes `3000`.

Release: `git tag frontend-v0.1.0 && git push --tags` builds and pushes a multi-arch image
to `ghcr.io/<org>/apos-frontend` with SBOM + provenance attestation.

> **Deferred decisions (recorded deliberately).**
>
> - **Thread list and pending-approval rehydration are BFF-owned, not backend-native.**
>   apos-backend has no `GET /api/threads/{id}` and no thread-list endpoint at all — threads
>   exist only in the LangGraph checkpointer with no HTTP read path. The BFF observes every
>   SSE envelope as it proxies and keeps its own in-memory thread store
>   (`src/lib/server/thread-store.ts`) to serve this. It is explicitly a shim: delete it the
>   day the backend ships the real endpoint. A multi-replica deployment needs a shared
>   implementation behind the same interface.
> - **"Modify" on the approval card is composed, not native.** `POST /api/approve` only
>   accepts `action: "approve" | "reject"` — a `"modify"` value is a 422, and
>   quantity/instrument cannot be amended server-side. Modify is implemented as reject-then-
>   resend on the same thread (`src/app/api/approvals/modify/route.ts`); the UI says so
>   plainly.
> - **Compliance rule chips show IDs with run-level tone, not per-rule pass/fail.** The SSE
>   `compliance` event carries `{status, rules: string[]}` — rule _IDs_ only, no sentences,
>   no per-rule outcome. Colouring individual chips as failed would fabricate information on
>   a compliance surface.
> - **Citation chips cannot show `model_version`/`snapshot_id` from the stream.** The
>   `citation` SSE event carries only `{capability_id, citation_id, binding_kind}`. Those
>   fields are joined in from `/api/risk/measures[].provenance` when resolvable; otherwise
>   the chip says so rather than guessing.
> - **Not every numeric claim in prose gets a citation chip.** Citations carry no text span
>   or offset tying them to a specific number in generated markdown. Regex-matching numbers
>   and attaching the nearest citation would risk a _wrong_ attribution on a compliance-
>   adjacent surface — worse than no attribution. Structured `RiskMeasure` values get exact
>   chips; prose gets a per-message citation ledger in event order instead.
> - **No AI model provider package is installed.** The chat route pipes apos-backend's own
>   SSE stream; the model lives entirely behind the backend.
> - **No E2E framework.** Vitest + RTL cover component and contract-boundary behaviour;
>   cross-repo E2E lives in apos-platform per the system's stated ownership split.
