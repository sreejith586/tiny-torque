#!/usr/bin/env bash
# PreToolUse hook (Edit|Write): block edits to files that must never change in a session (D-006, D-023, D-027).
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
  src/lib/theme.ts|src/app/globals.css)
    echo "BLOCKED (D-027): $rel carries Varun's theme values / base styles. A change here needs Varun's sign-off as a DECISIONS.md row first; then edit with the row ID in the commit message." >&2
    exit 2 ;;
esac
exit 0
