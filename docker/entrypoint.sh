#!/bin/sh
set -eu

: "${APOS_ENV:=prod}"
: "${PORT:=3000}"
: "${HOSTNAME:=0.0.0.0}"
export APOS_ENV PORT HOSTNAME

# Env validation itself lives in TypeScript (src/env/server.ts) and runs from
# instrumentation.ts before the server accepts traffic -- one list of
# required variables, not duplicated here.
exec "$@"
