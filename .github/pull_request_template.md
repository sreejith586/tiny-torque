## [MV-Sn-nn] Title

**Task:** MV-Sn-nn — link to row in `docs/plan/05-sprint-plan.md`
**Decisions touched (DECISIONS.md):** D-xxx, D-yyy
**Reversible:** yes | no — why
**Migration:** none | `NNNN_name.sql` (two-release rule respected: yes/no)
**Flag:** none | `flag_name`

### Plan (written before code, approved with "go")
-

### What changed
-

### Tests
- [ ] Vitest (domain rules)
- [ ] pgTAP (RLS / triggers) for touched tables
- [ ] Playwright smoke updated (critical flow)
- [ ] Checked in all 6 themes at 360px + 1280px; matches Varun's prototype (D-027)

### Reviewer checklist (Sreejith)
- [ ] No accepted decision contradicted; `guard.sh` green
- [ ] PROGRESS.md updated; new decisions appended to DECISIONS.md
- [ ] Deployable to prod dark behind its flag (D-028)
