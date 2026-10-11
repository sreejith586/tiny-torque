#!/usr/bin/env bash
# PreToolUse hook (Edit|Write): block edits to applied migrations (D-006).
# Design-review locks on globals.css/theme.ts were removed 2026-10-11 (D-059/D-060, Sreejith:
# "NOTHING needs protection... my decision supersedes"). The applied-migrations guard stays: it's
# not a design-review gate, it protects the staging/main databases' migration history from
# silently diverging from the repo (see the PGRST205/D-048 drift incident this guard exists to
# prevent) — flagged separately for explicit confirmation before removing, not bundled in here.
# Reads the tool input JSON from stdin; exit 2 blocks the tool call and shows the message to Claude.
input=$(cat)
path=$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
[ -z "$path" ] && exit 0
rel=${path#"$(git rev-parse --show-toplevel 2>/dev/null)/"}
case "$rel" in
  supabase/migrations/*)
    # Applied migrations are immutable: only files not yet on origin/staging may be edited.
    if git cat-file -e "origin/staging:$rel" 2>/dev/null || git cat-file -e "origin/main:$rel" 2>/dev/null; then
      echo "BLOCKED (D-006): $rel is an applied migration. Create a new migration with 'pnpm exec supabase migration new <name>' instead." >&2
      exit 2
    fi ;;
esac
exit 0
