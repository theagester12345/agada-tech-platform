# AGENTS.md emit — Binding (tool-agnostic default)

> This adapter documents the **compile/emit** step that turns authored workflow sources into an `AGENTS.md` tree. It is a **Binding**, not a second content source. Canonical altitude rules: [`WORKFLOW.md` → Instruction precedence](../../WORKFLOW.md#instruction-precedence).

## One source → compile per tool

| Authored source (edit these) | Emitted Binding (do not hand-edit) | Altitude |
|---|---|---|
| `WORKFLOW.md` (spine) | `/AGENTS.md` | 1 — same as spine |
| `<workspace>/CLAUDE.md` | `<workspace>/AGENTS.md` | 2 — same as that side's persona docs |

Same-altitude disagreement is **drift** — fix the source and re-emit. Do not rank `AGENTS.md` above or below `CLAUDE.md`.

**Start here** is authored in each side's `CLAUDE.md`, not added by the emit, so `CLAUDE.md` and `AGENTS.md` carry the same line. It sends an automatically loaded agent to `ARCHITECT.md` and its required initialization, which ends with the receipt ([`WORKFLOW.md` → Session start](../../WORKFLOW.md#session-start)).

## Per-host setup — making the bare `spec` shortcut work

The opener `ARCHITECT.md spec` works on every host with no setup, because the file is named in the message. A bare `spec` works only where the host loaded that side's Start here line at start-up. Where it did not, the receipt is missing, and that shows it. Set up once per machine or repo, as your host needs. **None of this ships as a config file:** a host's config in the payload would privilege that host in the base.

| Host | What it reads at start (verified 2026-10-19, from each host's docs) | Setup for bare `spec` |
|---|---|---|
| Claude Code | `CLAUDE.md` in the start folder and every folder above; `AGENTS.md` only where no `CLAUDE.md` exists | None: each side's `CLAUDE.md` carries Start here |
| Codex | `AGENTS.md` from the git root down to the start folder, **until 32 KiB in total** (`project_doc_max_bytes`) | The root `AGENTS.md` (the spine) is larger than that, so the side's file is never reached. Raise the budget in `~/.codex/config.toml`: `project_doc_max_bytes = 131072` |
| Gemini CLI | `GEMINI.md` by default; other names only through `context.fileName` | `.gemini/settings.json`: `{"context": {"fileName": ["AGENTS.md", "GEMINI.md"]}}` |
| GitHub Copilot | `AGENTS.md` at the repo root and in the working folder | None reported |
| Cursor | Nested `AGENTS.md`, scoped to its folder (community-reported) | None reported |

Sources: Claude Code memory docs; Codex `AGENTS.md` docs; Gemini CLI `GEMINI.md` docs; GitHub's Copilot `AGENTS.md` changelog; Cursor forum. Hosts change; the receipt is what tells you whether a setup worked.

`scaffold.sh` runs the emit after it copies and processes sources.

**An emitted file is recognised by its marker, never by its name.** Every Binding opens with the `⚙️ **EMITTED Binding**` line. An `AGENTS.md` without it is the project's own (Lovable, Codex and Copilot users write one): the emit refuses to overwrite it, `--force` included, and the hook never stages it. `--list` prints the Bindings the emit owns, one path per line, and is how the hook and the master's tooling know which those are. **Where the project owns the root `AGENTS.md`, no root Binding is emitted**, so a host that reads only `AGENTS.md` (Codex, Copilot) does not reach the workflow from it; the scaffold's workorder says so. The marker is the whole test, so a Binding whose first line was hand-edited counts as the project's own from then on, and `--force` no longer repairs it. Not done instead: appending a fenced block to the project's file (in client-repo mode it would commit the workflow into the client's repo), or a second filename such as `AGENTS.workflow.md` (no host reads it).

**Keeping Bindings fresh (automatic):** `.githooks/pre-commit` re-runs emit with `--force` and stages the Bindings it wrote whenever `WORKFLOW.md`, any `CLAUDE.md`, or any `AGENTS.md` is staged for commit. Humans and agents do not need to remember the script for the common case. Mid-session (before commit) you can still run:

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
