# Plane adapter — the tracker **Binding**


The **Principle** lives in [`WORKFLOW.md` → Task Tracker Sync](../../WORKFLOW.md#task-tracker-sync--the-mirror-principle): `TASK.md` is the single source of truth; the tracker is a **one-way downstream mirror**; correlation is a deterministic `external_id` + `external_source`; writes are scoped and idempotent; **dry-run before live**.

This directory is the **Binding** — the concrete implementation for **Plane**. Swapping trackers later (Linear, Jira, GitHub Issues) means adding a sibling adapter, **not** touching the spine.

## One copy, many consumers — do NOT fork it

[`sync-plane.js`](./sync-plane.js) derives **nothing** from `__dirname`; every path is configuration. The same file serves backend, frontend, and the workflow master. Forking it per workspace is what causes two copies to drift ("keep these logic-identical" comments are a bug report, not a plan). If it needs a fix, fix it **here**.

## Renderer contract (and its tests — don't skip them)

`mdToHtml` turns a task's markdown body into the tracker's HTML. Its list-item pattern **must consume an optional task-checkbox as one pinned unit** — permitted state chars `[ xX~]`, a **required** trailing space — never a wildcard state char (`\[.\]`, which eats a short markdown link label) and never independently-optional brackets (`\[?.?\]?`, which eats the first character of every non-checkbox bullet). Both bugs are silent: the corruption is deterministic, so the sync's own idempotency check agrees with the mangled text and reports "unchanged."

[`sync-plane.test.js`](./sync-plane.test.js) is the guard — run it after any change to the renderer (`node --test adapters/plane/sync-plane.test.js`; pass the file, not the dir). It asserts on tag **ordering/pairing** (not counts — broken output was count-balanced while inverted) and brute-forces the character space. The script is **require-safe** (runs `main` only via `require.main === module`; exports the pure helpers) precisely so these tests can import the transform without firing a live sync. When you first sync after a renderer fix, expect **essentially every task body to change once** — that's the repair, not a regression.

## Setup (once per project)

1. **Create the Plane project + a workspace API token** (Workspace settings → API tokens).
2. **The board must have these states** (exact names): `Todo`, `In Progress`, `Blocked`, `Done`.
   _(Plane's `Backlog` state is intentionally never a target — it's your manual idea space.)_
3. **Create any labels** your `Category` values map to (Project settings → Labels). Default map: `Frontend`, `Backend`, `Infrastructure`.
4. **Fill the gitignored `.env`** (never commit it — see [`WORKFLOW.md` → Secrets & environment](../../WORKFLOW.md#secrets--environment)):

```bash
PLANE_URL=<plane host>              # e.g. https://plane.example.com
PLANE_WORKSPACE=<workspace-slug>
PLANE_PROJECT_ID=<project-uuid>
PLANE_API_TOKEN=<workspace-api-token>
PLANE_KEY_PREFIX=BE-                # per side; see below
```

## Usage

**Always dry-run first, then live.** Run from the workspace whose `TASK.md` you're syncing:

```bash
node ../adapters/plane/sync-plane.js --dry-run   # preview; writes nothing
node ../adapters/plane/sync-plane.js             # push TASK.md → Plane
```

Flags (all optional — everything is configuration):

| Flag | Default | Purpose |
|---|---|---|
| `--dry-run` | off | print the planned diff, write nothing |
| `--root DIR` | cwd | base dir for relative paths |
| `--tasks PATH` | `$TASKS_FILE` or `<root>/TASK.md` | which `TASK.md` to read |
| `--env PATH` | `<root>/.env` | which env file to load — from a **doc home**, point at the **code-root** `.env` ([One `.env` at the code root](../../WORKFLOW.md#one-env-at-the-code-root)) |
| `--prefix STR` | `$PLANE_KEY_PREFIX` or none | `external_id` prefix |
| `--adopt` | off | allow UPDATE when a **newly introduced** TASK id already exists on the board (hand-stamped card adoption). Default: **refuse** (mirror Principle) |

**Removal propagates:** a task deleted from `TASK.md` is **deleted from the board** on the next run (only cards carrying this source's `external_source` — hand-made cards are never touched). Dry-run lists every deletion first, so **read it**: an edit that drops a task by accident is indistinguishable from one that drops it on purpose, and the dry-run is where the difference shows up.

**Safety:** duplicate `TASK-XXX` headings in the source file are a **parse error** (no writes). Ids newly present vs `git HEAD` of that file that already exist on the board are **refused** unless `--adopt`. **The usual cause of that refusal is not an error:** commits are user-gated, so a card is often synced before `TASK.md` is committed — until it is, the id reads as new while the board already has it. **Commit the source**; the refusal stops. `--adopt` is for a card you made by hand and are deliberately adopting, and it overwrites what is there, so it is never the way to make the guard quiet. A run that parses **zero** tasks refuses to delete anything — that is a wrong `--tasks` path, not a request to empty the board.

## Key prefixes (shared boards)

The prefix namespaces `external_id` so consumers never collide on **one** board:

| Consumer | Prefix | `external_id` |
|---|---|---|
| backend | `BE-` | `BE-TASK-018` |
| frontend | `FE-` | `FE-TASK-004` |
| the workflow master itself | `WF-` | `WF-TASK-001` |

On a **dedicated** board the prefix is cosmetic, but keep one anyway — `external_id` should stay stable and namespaced if boards ever merge.

## Guarantees

- **One card per task, zero duplicates** — correlation key is `external_id` (`<PREFIX>TASK-XXX`) + `external_source` (`tasks-md`). The script indexes existing issues, then updates or creates.
- **Scoped writes** — only issues carrying our `external_source` are ever touched. Manual Backlog ideas and another side's issues are never modified.
- **Idempotent** — descriptions are compared as *plain text* on both sides, so Plane's HTML re-normalization never causes churn. A second run reports `unchanged`.
- **Never writes back** to `TASK.md`. The mirror is one-way, always.
- **Zero dependencies** — Node 18+ (native `fetch`) and nothing else. No `npm install`.

## Mapping

`Status` → state and `Priority` → priority are **canonical** (see [`WORKFLOW.md` → Canonical Task Format](../../WORKFLOW.md#canonical-task-format)) and live in the script. `Category` is **per-side**, so its label map is overridable without editing code:

```bash
PLANE_LABEL_MAP={"Feature":"Feature","Bug":"Bug","Refactor":"Infrastructure"}
```

| `TASK.md` | Plane |
|---|---|
| `TODO` / `IN_PROGRESS` / `BLOCKED` / `COMPLETED` | `Todo` / `In Progress` / `Blocked` / `Done` |
| `Critical` / `High` / `Normal` / `Low` | `urgent` / `high` / `medium` / `low` |

## Troubleshooting

- **"Missing required env var(s)"** — fill `.env` (or export them); real process env always wins over the file.
- **"Plane project has no state named X"** — create the state, or your board predates the required set.
- **"has no label named X"** — create it, or fix `PLANE_LABEL_MAP`.
- **429s** — handled automatically (honors `Retry-After`, then exponential backoff).
