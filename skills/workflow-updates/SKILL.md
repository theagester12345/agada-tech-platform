---
name: workflow-updates
description: 'Use when the user says "reload", or asks to execute a PULL_WORKORDER.md, HARVEST_WORKORDER.md or UPGRADE_WORKORDER.md: re-reading the rules mid-session, and the plan-then-approve sequence for workflow sync workorders.'
---

# Workflow updates — `reload` and the sync workorders


Part of the workflow spine, kept here so it loads only when a task needs it. The rule and its trigger stay in [`WORKFLOW.md`](../../WORKFLOW.md); this is the procedure. Edit it here — `.claude/skills/` holds generated copies.

## `reload` — re-read the rules mid-session

A session reads the workflow once, at initialization, and keeps it in context. When an upgrade lands while sessions are running, every live session keeps obeying the old rules and nothing tells it otherwise. Restarting works, but throws away the task context. **`reload` is one command, identical on every side,** that a running session obeys between steps:

1. Re-read the spine and this side's own persona docs and outbox header — the same set it reads at initialization — **from disk, not from memory**.
2. Report in a few lines which rules changed and what they require of the current work. The project's `.workflow-sync` stamp names the master commit last applied: a session that noted it at initialization compares it, so "what changed" is checked rather than recalled; one that did not says its report is from memory.
3. Confirm its mode.

- **It refreshes rules, never authorization.** It does not open BUILD, approve anything, or resume a paused task.
- **Mid-task, it finishes the current atomic step first** and says where it stopped.
- **A re-read rule that contradicts work already done is reported**, never silently redone.
- **It is not `sync`**, which pulls *work* (outbox entries, READY features). `reload` may end with one, since a new rule can change what a side must read.

## Workflow sync workorders (PULL / UPGRADE / HARVEST)

Scripts write a workorder; an agent applies it. **"Execute \<workorder\>" authorizes the process — not a silent jump to edits.**

Applies to: `PULL_WORKORDER.md`, `HARVEST_WORKORDER.md` (project → master), and `UPGRADE_WORKORDER.md` (master → project). (Bootstrap/adopt `WORKORDER.md` already gates doc moves behind propose-then-approve; this section is the sync channel.)

**An `UPGRADE_WORKORDER.md` runs from the project root, in a session opened there.** An upgrade touches every side, and a side's agent may not edit another side's files, so a side session would stop at the scope walls halfway through. **A session opened in a side that finds one reports it and stops**; it never executes it. The workorder's own first lines say the same.

**An upgrade arrives partly applied.** The script has already replaced the adapters, hooks and skills this project never edited, copied new ones, and merged the spine into `WORKFLOW.md.upgrade`; the workorder lists each under *Already applied by the script*, and nothing is committed. So the plan step **shows those changes first** (`git diff`, `git status`), then the spine's conflict regions and how each is resolved, then the rest. Implementing it means resolving the conflicts in `WORKFLOW.md.upgrade`, replacing `WORKFLOW.md` with it and deleting the `.upgrade` file, porting what *Left for you* lists and the diff below it, and re-emitting the generated copies.

**Required sequence:**

1. **Plan (no template/project convention edits yet).** Publish a short absorb/apply plan covering: which entry ids (`WFC-` / `MOC-`) you will take; which files you expect to touch; any deliberate deviations or rejects (and why); open questions. Stop.
2. **Wait for explicit approval** of that plan (or a revised plan). Ambiguous enthusiasm, "looks good" on an earlier analysis, or naming the workorder alone does **not** skip this step once the plan exists — approve the *plan*, then implement.
3. **Implement** only what was approved; record ledger ids; delete the workorder when done.

> **Rejected alternative:** treating "execute PULL_WORKORDER.md" / "execute UPGRADE_WORKORDER.md" as permission to write immediately. That collapses review into after-the-fact regret on irreversible spine/MIT changes.
