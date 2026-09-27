#!/usr/bin/env bash
# Validate all migrations in order against a throwaway Postgres (fallback when `supabase start` is unavailable).
# Usage: DATABASE_URL=postgres://postgres@127.0.0.1:54329/postgres bash scripts/db-validate.sh
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists mv_validate;" -c "create database mv_validate;"
URL="${DATABASE_URL%/*}/mv_validate"
psql "$URL" -v ON_ERROR_STOP=1 -q -f scripts/pg-stub.sql
for f in supabase/migrations/*.sql; do echo "→ $f"; psql "$URL" -v ON_ERROR_STOP=1 -q -f "$f"; done
echo "✔ all migrations applied"
echo "$URL" > .validate-db-url
