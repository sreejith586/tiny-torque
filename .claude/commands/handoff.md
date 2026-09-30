---
description: End the session with the D-023 hand-off (PROGRESS.md, DECISIONS.md, guard, commit, push)
---

Close this session following CLAUDE.md "End":

1. Update `docs/plan/PROGRESS.md`: task board row status (`todo` / `in-progress (branch)` / `in-review (PR #)` / `done` / `blocked (why)`), "Active task", "Last session" (one line: what changed), "Next action" (the exact next command or task), Blockers, and one session-log row (keep the log ≤ 5 rows, file ≤ 120 lines).
2. If any decision was made this session, append a row to `docs/plan/DECISIONS.md` (never edit old rows; bump "Next ID"). If none, say so explicitly.
3. Run `pnpm typecheck && pnpm lint && pnpm test && bash docs/plan/tools/guard.sh`. Fix failures or record them in PROGRESS.md › Blockers.
4. If the sprint plan changed, edit `docs/plan/tools/backlog.json` and run `python3 docs/plan/tools/render.py` — never edit `05-sprint-plan.md` or `backlog.csv` by hand.
5. Commit everything with subject `[MV-Sn-nn] <what>` and push the sprint/task branch. Do not open PRs into `main`; PRs go to `staging` only, and Sreejith merges.
6. Reply with a 5-line summary: task ID and status · commits pushed · D-rows added · what is left · the next command for the next session.
