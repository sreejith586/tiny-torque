#!/usr/bin/env bash
# Stop hook: when the session ends with uncommitted changes, remind about the end-of-session protocol.
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 0
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "Uncommitted changes present. End-of-session protocol (CLAUDE.md): update docs/plan/PROGRESS.md, append any DECISIONS.md row, run 'bash docs/plan/tools/guard.sh', commit with the [MV-Sn-nn] tag, push the sprint branch. Use /handoff."
fi
exit 0
