---
description: Start a Mini Vault task with the D-023 session protocol (usage: /task MV-S1-01)
---

Start task **$ARGUMENTS** following CLAUDE.md exactly. Do these steps in order and do not skip any:

1. Read `docs/plan/PROGRESS.md` in full. If "Active task" names a different task that is not `done`, stop and ask which one to continue.
2. Read `docs/plan/DECISIONS.md` (ID + Decision columns at minimum). It is binding.
3. Read ONLY the `$ARGUMENTS` row in `docs/plan/05-sprint-plan.md` (`grep -n "$ARGUMENTS" docs/plan/05-sprint-plan.md`), then the F-xx section of `docs/plan/04-feature-specs.md` and the table sections of `docs/plan/03-data-model.md` that the row references. Use grep for anything else; do not read whole documents.
4. If the task touches UI: the visual reference is handover commit `fd3b02d` (`git show fd3b02d:<path>`). Compose only from existing prototype pieces (CLAUDE.md rule 12). Pixel baselines in `e2e/__screenshots__` will fail CI on any visual change — plan to regenerate them in the same PR and state why.
5. Confirm you are on the sprint branch (`sprint-N`, cut from `staging`) or a task branch `mv/S{n}-{id}-{slug}`. Never work on `main` or `staging`.
6. Reply with, and nothing more: task ID · the D-xxx rows this task touches · files you will change · migration yes/no (and its name) · tests you will add (Vitest / pgTAP / Playwright) · estimated hours vs the row's estimate. Then **wait for "go"**.

After "go": one commit per logical step, subject `[$ARGUMENTS] …`, order migration → gen:types → domain → service + tests → UI → Playwright → docs (D-020). Update `docs/plan/PROGRESS.md` at every checkpoint (task board status, active task, notes). If anything contradicts an accepted D-row or the prototype, stop and write the question into PROGRESS.md › Blockers.
