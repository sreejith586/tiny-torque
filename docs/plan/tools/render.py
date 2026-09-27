import json, csv, sys, os
SP = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(SP, "..", "..", ".."))
data = json.load(open(os.path.join(SP, "backlog.json")))
meta, sprints = data["meta"], data["sprints"]

lines = []
w = lines.append
w("# 05 — Sprint Plan & Task Backlog")
w("")
w("> Status: DRAFT v1 — 2026-09-27. Generated from `backlog.json` (source of truth) — edit the JSON and re-run `docs/plan/tools/render.py`; `backlog.csv` is Jira-importable (Summary, Description, Epic/Feature, Sprint, Estimate, Dependencies).")
w("")
w("## Cadence & capacity")
w("")
w(f"- **Cadence:** {meta['cadence']}")
w(f"- **Planned capacity:** ≈ {meta['capacity_hours']} h of your focused time per sprint (you driving Claude Code). Sprints are planned to 18–21 h; the rest is slack for review, surprises and life. Items marked STRETCH are pulled only when a sprint is ahead.")
w(f"- **Estimates:** {meta['estimate_note']}")
w("- **Sequencing rule:** DB migration → domain service (+ tests) → UI → Playwright smoke, inside every sprint. Never UI before the migration is on staging.")
w("- **Locking rule:** a sprint is 'locked' on its Monday. New asks go to the next sprint or the stretch register — never into a running sprint (buffer sprint 11 exists so this holds).")
w(f"- **Release rule (D-028):** {meta['release_rule']}")
w("")
w("## Definition of Done (every task)")
w("")
for d in meta["definition_of_done"]:
    w(f"- {d}")
w("")
w("## Timeline at a glance")
w("")
w("| Sprint | Theme | Planned h | Stretch h | Key migration(s) | Flags introduced |")
w("|---|---|---|---|---|---|")
flags = {0:"—",1:"invite_only, email_otp",2:"csv_import",3:"ai_scan, ai_scan_group",4:"marketplace_publish",5:"offers",6:"deal_chat",7:"token_purchase, pro_purchase",8:"—",9:"—",10:"—",11:"—"}
migs = {0:"0000 baseline, 0001 housekeeping",1:"0002 identity_v2",2:"0003 media, 0004 garage_v2",3:"0005 catalog",4:"0006 marketplace_v2",5:"0007 deals",6:"0008 messaging_trust",7:"0009 tokens",8:"0010 gamification",9:"0011 jobs",10:"—",11:"—"}
total_planned = total_stretch = 0
for s in sprints:
    planned = sum(t["est"] for t in s["tasks"] if not t["title"].startswith("STRETCH"))
    stretch = sum(t["est"] for t in s["tasks"] if t["title"].startswith("STRETCH"))
    total_planned += planned; total_stretch += stretch
    w(f"| S{s['id']} | {s['name']} | {planned:g} | {stretch:g} | {migs[s['id']]} | {flags[s['id']]} |")
w(f"| **Total** | 12 sprints ≈ 12 weeks build + launch | **{total_planned:g}** | {total_stretch:g} | | |")
w("")
w("Pilot runs 8–12 weeks after S11 with a weekly maintenance sprint capped at 10 h. H2 planning starts at pilot week 6 using real data.")
w("")
w("## What is live in production after each sprint (D-028)")
w("")
w("| Sprint | Production increment |")
w("|---|---|")
for s in sprints:
    w(f"| S{s['id']} | {s['ships']} |")
w("")
w("## Dependency spine (critical path)")
w("")
w("S0 stack/migrations → S1 identity+events+flags → S2 media+garage → S3 catalogue+AI → S4 listings → S5 offers → S6 chat/trust → S7 tokens (retro-wires S2/S3/S4 gates) → S8/S9 polish → S10 hardening → S11 launch. S8 and S9 are the only sprints that could swap order without breaking dependencies.")
w("")
w("---")
w("")
for s in sprints:
    planned = sum(t["est"] for t in s["tasks"] if not t["title"].startswith("STRETCH"))
    w(f"## Sprint {s['id']} — {s['name']}")
    w("")
    w(f"**Goal.** {s['goal']}")
    w("")
    w(f"**Demo at end of sprint.** {s['demo']}")
    w("")
    w(f"**Ships to production.** {s['ships']}")
    w("")
    w(f"**Risks / watch-outs.** {s['risks']}")
    if s.get("decisions_locked"):
        w("")
        w("**Decisions locked this sprint:** " + "; ".join(s["decisions_locked"]))
    w("")
    w(f"**Planned hours:** {planned:g}")
    w("")
    w("| ID | Feature | Type | Task | What done looks like | Est (h) | Depends on |")
    w("|---|---|---|---|---|---|---|")
    for t in s["tasks"]:
        w(f"| {t['id']} | {t['feature']} | {t['type']} | {t['title']} | {t['desc']} | {t['est']:g} | {t['deps'] or '—'} |")
    w("")
    w("---")
    w("")

open(os.path.join(OUT, "docs/plan/05-sprint-plan.md"), "w").write("\n".join(lines))

with open(os.path.join(OUT, "docs/plan/backlog.csv"), "w", newline="") as f:
    cw = csv.writer(f)
    cw.writerow(["Issue Type","Summary","Description","Epic","Sprint","Estimate (h)","Labels","Depends On","Issue Key"])
    for s in sprints:
        for t in s["tasks"]:
            cw.writerow(["Task", f"[{t['id']}] {t['title']}", t["desc"], t["feature"], f"Sprint {s['id']}", t["est"], t["type"] + (",stretch" if t["title"].startswith("STRETCH") else ""), t["deps"], t["id"]])
print("ok", total_planned, total_stretch, sum(len(s["tasks"]) for s in sprints))
