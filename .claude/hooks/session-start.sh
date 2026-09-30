#!/usr/bin/env bash
# Claude Code SessionStart hook — puts the live state in front of every session (D-023).
# Prints PROGRESS.md "Current position", the sprint board, and the protocol reminder.
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 0
echo "=== Mini Vault session start — CLAUDE.md protocol applies (D-023) ==="
echo "Branch: $(git branch --show-current 2>/dev/null)   Head: $(git log --oneline -1 2>/dev/null)"
echo
awk '/^## Current position/{f=1} /^## S0 closing board/{f=0} /^## Release procedure/{f=0} f' docs/plan/PROGRESS.md
echo
awk '/^## S1 task board/{f=1} /^## Release procedure/{f=0} f' docs/plan/PROGRESS.md
echo
echo "Decisions: $(grep -cE '^\| D-[0-9]{3} ' docs/plan/DECISIONS.md) rows, next ID $(grep -oE 'Next ID: D-[0-9]{3}' docs/plan/DECISIONS.md)"
echo "Protocol: read PROGRESS.md -> DECISIONS.md -> ONLY the task row (05) + F-xx (04) + tables (03) -> reply with task ID, D-rows touched, files, migration y/n, tests -> wait for 'go'."
echo "Use /task <MV-Sn-nn> to start a task and /handoff to end the session."
