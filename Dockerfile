# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.23.2
ARG PNPM_VERSION=11.18.0

# ---------------------------------------------------------------- deps
# Warms the pnpm virtual store from the lockfile alone. `pnpm fetch` reads
# ONLY pnpm-lock.yaml + pnpm-workspace.yaml, never package.json -- so
# bumping a script or any other package.json field does not invalidate this
# (slow) download layer.
FROM node:${NODE_VERSION}-bookworm-slim AS deps
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm CI=1 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack install -g pnpm@${PNPM_VERSION}
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

# ---------------------------------------------------------------- builder
FROM deps AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --offline
RUN pnpm build

# ---------------------------------------------------------------- runtime
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

RUN groupadd --gid 10001 apos \
 && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin apos

# output: 'standalone' emits exactly three things that matter: server.js +
# a pruned node_modules, .next/static (NOT copied by server.js by default),
# and public. All three must land at these exact paths or the app 404s every
# CSS/image asset while still appearing to boot.
COPY --from=builder --chown=10001:10001 /app/.next/standalone ./
COPY --from=builder --chown=10001:10001 /app/.next/static ./.next/static
COPY --from=builder --chown=10001:10001 /app/public ./public
COPY --from=builder --chown=10001:10001 /app/backend-version.txt ./backend-version.txt

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 0755 /usr/local/bin/entrypoint.sh

USER 10001
EXPOSE 3000

HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=5 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/api/healthz`).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
