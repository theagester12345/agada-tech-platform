# AGENTS.md emit — Binding (tool-agnostic default)

> This adapter documents the **compile/emit** step that turns authored workflow sources into an `AGENTS.md` tree. It is a **Binding**, not a second content source. Canonical altitude rules: [`WORKFLOW.md` → Instruction precedence](../../WORKFLOW.md#instruction-precedence).

## One source → compile per tool

| Authored source (edit these) | Emitted Binding (do not hand-edit) | Altitude |
|---|---|---|
| `WORKFLOW.md` (spine) | `/AGENTS.md` | 1 — same as spine |
| `<workspace>/CLAUDE.md` | `<workspace>/AGENTS.md` | 2 — same as that side's persona docs |

Same-altitude disagreement is **drift** — fix the source and re-emit. Do not rank `AGENTS.md` above or below `CLAUDE.md`.

Workspace outputs add one generated **Start here** preamble before the copied
`CLAUDE.md` body. It directs an automatically booted agent to read
`ARCHITECT.md` and execute its required initialization. This is the missing
bootstrap link between automatic discovery and the existing active-read ritual:
`AGENTS.md` gets the agent through the door; `ARCHITECT.md` loads
`WORKFLOW.md`, `CLAUDE.md`, task state, history, and peer context.

`scaffold.sh` runs the emit after it copies and processes sources.

**Keeping Bindings fresh (automatic):** `.githooks/pre-commit` re-runs emit with `--force` and stages the result whenever `WORKFLOW.md`, any `CLAUDE.md`, or any `AGENTS.md` is staged for commit. Humans and agents do not need to remember the script for the common case. Mid-session (before commit) you can still run:

```bash
# from a scaffolded project (script ships in adapters/):
bash adapters/agents/emit-agents.sh --force
```

## Adding a third tool (e.g. `.cursor/rules`)

**Whether to add one: a per-tool target earns its place only where `AGENTS.md` cannot reach.** This is not a prohibition — per-tool output is exactly what a Binding is *for*. The cost is **maintenance**: a target is pinned to one vendor's file layout and rots at that vendor's pace, while `AGENTS.md` is a convention many hosts already share. So the test is **reach, not preference** — *can this host read `AGENTS.md`?* If it can, it is already served, and a second target buys only another file to keep current. If it cannot, add the target. The asymmetry has been paid for once: a target was proposed for **Roo Code**, which announced sunset ~2026-04-20 and was archived read-only on 2026-05-15 — the kit died before the question was answered, while the `AGENTS.md` route it would have duplicated needed no change.

Do **not** author a new content body. Add another compile target that reads the **same** sources:

1. Map each authored file → the tool's destination (e.g. `.cursor/rules/workflow.mdc` ← `WORKFLOW.md`).
2. Keep the output a Binding (header or front-matter that names the source).
3. Wire the new target into `emit-agents.sh` (or a sibling `emit-cursor.sh` called from the same hook in `scaffold.sh`) so one `emit` pass refreshes every Binding.

Claude-specific filenames (`CLAUDE.md`) stay as the **authored** side persona body in this workflow; hosts that only read `AGENTS.md` get the emitted copy. Hosts that read `CLAUDE.md` natively keep using the source. Both must stay identical in substance — emit is what enforces that.

## Out of scope here

- Model routing / which model runs the agent (see open tasks on emit targets / model guidance).
- Per-tool permission config generated from the permission table (optional future Binding).
