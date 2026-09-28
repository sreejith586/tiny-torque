---
description: Record a decision as an append-only DECISIONS.md row (usage: /decide <one-line decision>)
---

Append a new row to `docs/plan/DECISIONS.md` for: $ARGUMENTS

Rules: use the "Next ID" from the file's last comment line and bump it; today's date; one line; columns `ID | Date | Decision | Why (short) | Reversibility | Status | Ref`; status `proposed` unless Sreejith said it is final in this conversation (then `accepted`); if it changes an earlier row, write `Supersedes: D-xxx` in the Decision column and leave the old row untouched. Then mirror the row under "Decisions made this sprint" in `docs/plan/PROGRESS.md` and, if CLAUDE.md has a rule that this decision changes, update that rule in the same commit. Show me the row before writing it.
