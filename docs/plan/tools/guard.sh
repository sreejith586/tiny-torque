#!/usr/bin/env bash
# Decision guard — fails CI (and pre-push) when code contradicts an accepted row in docs/plan/DECISIONS.md.
# Cheap, grep-based, deliberately dumb. Add a check whenever a new decision has a greppable footprint.
# Usage: bash docs/plan/tools/guard.sh   (run from repo root)
set -euo pipefail
fail=0
say() { echo "✖ [$1] $2"; fail=1; }

# D-007: Supabase client only inside repo.ts / lib/supabase / Edge functions / e2e fixtures
if grep -rnE "from ['\"]@supabase/" src --include='*.ts' --include='*.tsx' \
  | grep -vE "src/domain/[^/]+/repo\.ts|src/lib/supabase/|src/types/supabase\.ts" ; then
  say D-007 "@supabase import outside domain/*/repo.ts or lib/supabase"
fi

# D-012: no hardcoded country code (enforced once identity_v2 / the country picker ships in S1)
if ls supabase/migrations/*_identity_v2.sql >/dev/null 2>&1 && grep -rnE "COUNTRY_CODE\s*=\s*['\"]\+91" src ; then say D-012 "hardcoded +91 country code"; fi

# D-021: offers / token_ledger must not be written directly from app code (RPC only)
if grep -rnE "from\(['\"](offers|token_ledger|token_purchases|entitlement_grants)['\"]\)\s*\.\s*(update|insert|upsert|delete)" src ; then
  say D-021 "direct write to offers/token tables — use transition_offer / spend_tokens RPC"
fi

# D-010: no writes to legacy photos jsonb after migration 0004 exists
if ls supabase/migrations/*_garage_v2.sql >/dev/null 2>&1 && grep -rnE "\bphotos\s*:" src/domain --include='*.ts' | grep -v "_v1" ; then
  say D-010 "write to legacy photos jsonb — use media rows"
fi

# D-014: service-role key must never appear in Next.js runtime
if grep -rnE "SUPABASE_SERVICE_ROLE|service_role" src ; then say D-014 "service-role key referenced in Next.js code"; fi

# D-027: no raw hex colours in components (tokens only)
if grep -rnE "#[0-9a-fA-F]{6}\b" src/components src/app --include='*.tsx' | grep -v "globals.css" ; then
  say D-027 "hex colour in component — use theme tokens"
fi

# D-027: no complex UI libraries — data grids, kanban/DnD, command palettes, custom pickers, chart kits
if grep -nE '"(@tanstack/react-table|react-data-grid|ag-grid[^"]*|cmdk|@dnd-kit/[^"]*|react-beautiful-dnd|@hello-pangea/dnd|react-select|downshift|react-day-picker|@mui/[^"]*|antd|@chakra-ui/[^"]*|@mantine/[^"]*|recharts|chart\.js|@nivo/[^"]*|framer-motion|swiper|embla-carousel[^"]*)"' package.json ; then
  say D-027 "UI library outside the prototype's patterns added to package.json — Varun's sign-off needed in DECISIONS.md"
fi

# D-027: shadcn = primitives only; anything else under src/components/ui needs a DECISIONS.md row
if [ -d src/components/ui ]; then
  allowed='^(button|input|textarea|label|select|checkbox|radio-group|switch|sheet|dialog|alert-dialog|dropdown-menu|popover|tooltip|toast|sonner|toaster|tabs|badge|avatar|separator|skeleton|progress|form|scroll-area|utils)\.tsx?$'
  if ls src/components/ui | grep -vE "$allowed" ; then
    say D-027 "non-primitive file in src/components/ui — shadcn primitives only (see CLAUDE.md rule 12)"
  fi
fi

# D-027: visual baselines exist and are only changed together with a UI change in the same PR
if [ ! -d e2e/__screenshots__ ] || [ "$(ls e2e/__screenshots__/*.png 2>/dev/null | wc -l)" -lt 19 ]; then
  say D-027 "e2e/__screenshots__ baselines missing — run pnpm test:e2e:update on Linux and commit them"
fi

# D-006: applied migrations are immutable (compare against main)
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  if git diff --name-status origin/main -- supabase/migrations | grep -E "^(M|D)\s" ; then
    say D-006 "an existing migration file was modified or deleted"
  fi
fi

# D-023: decision log is append-only and CLAUDE.md stays short
if git rev-parse --verify origin/main >/dev/null 2>&1 && git cat-file -e origin/main:docs/plan/DECISIONS.md 2>/dev/null; then
  before=$(git show origin/main:docs/plan/DECISIONS.md | grep -cE '^\| D-[0-9]{3} ' || true)
  after=$(grep -cE '^\| D-[0-9]{3} ' docs/plan/DECISIONS.md || true)
  if [ "$after" -lt "$before" ]; then say D-023 "DECISIONS.md rows were removed ($before → $after)"; fi
fi
if [ -f CLAUDE.md ] && [ "$(wc -l < CLAUDE.md)" -gt 200 ]; then say D-023 "CLAUDE.md exceeds 200 lines"; fi
if [ -f docs/plan/PROGRESS.md ] && [ "$(wc -l < docs/plan/PROGRESS.md)" -gt 120 ]; then say D-023 "PROGRESS.md exceeds 120 lines — trim history"; fi

if [ "$fail" -eq 0 ]; then echo "✔ decision guard passed"; fi
exit $fail
