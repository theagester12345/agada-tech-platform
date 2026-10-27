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
4. **Fill the gitignored repo-root `.env`** — one file every side shares, separate from each app's `.env` ([one tooling `.env`](../../WORKFLOW.md#one-env-at-the-code-root)); never commit it — see [`WORKFLOW.md` → Secrets & environment](../../WORKFLOW.md#secrets--environment)):

```bash
PLANE_URL=<plane host>              # e.g. https://plane.example.com
PLANE_WORKSPACE=<workspace-slug>
PLANE_PROJECT_ID=<project-uuid>
PLANE_API_TOKEN=<workspace-api-token>
```
The key prefix and side label are **not** set here: each side passes them as flags (below), so one board's credentials have one home and each side's own values stay in its own command.

## Usage

**Always dry-run first, then live.** Run from the workspace whose `TASK.md` you're syncing:

```bash
node ../adapters/plane/sync-plane.js --dry-run --env ../.env --prefix BE- --side-label Backend   # preview; writes nothing
node ../adapters/plane/sync-plane.js --env ../.env --prefix BE- --side-label Backend             # push TASK.md → Plane
```

Flags (all optional — everything is configuration):

| Flag | Default | Purpose |
|---|---|---|
| `--dry-run` | off | print the planned diff, write nothing |
| `--root DIR` | cwd | base dir for relative paths |
| `--tasks PATH` | `$TASKS_FILE` or `<root>/TASK.md` | which `TASK.md` to read |
| `--archive PATH` | `TASK_ARCHIVE.md` beside the tasks file | its archive, read as part of the source; a missing file is an empty one |
| `--env PATH` | `<root>/.env` | which env file to load — from a **doc home**, `--env ../.env`: the **repo-root** tooling `.env` every side shares ([one tooling `.env`](../../WORKFLOW.md#one-env-at-the-code-root)) |
| `--prefix STR` | `$PLANE_KEY_PREFIX` or none | `external_id` prefix; also shown in the card title |
| `--side-label STR` | `$PLANE_SIDE_LABEL` or the Category mapping | label every card with this side's label (e.g. `Backend`) |
| `--adopt` | off | allow UPDATE when a **newly introduced** TASK id already exists on the board (hand-stamped card adoption). Default: **refuse** (mirror Principle) |

**The archive is part of the source:** `TASK_ARCHIVE.md` beside the board (or `--archive PATH`) is read with `TASK.md` as one source, so a card [moved there](../../CONSOLIDATION.md#the-board-moves-by-script) stays on the board, unchanged. An id in both files is refused, like any duplicate.

**Removal propagates:** a task deleted from `TASK.md` **and** its archive is **deleted from the board** on the next run (only cards carrying this source's `external_source` — hand-made cards are never touched). Dry-run lists every deletion first, so **read it**: an edit that drops a task by accident is indistinguishable from one that drops it on purpose, and the dry-run is where the difference shows up.

**Safety:** duplicate `TASK-XXX` headings in the source file are a **parse error** (no writes). An UPDATE on a card **nobody attributes to this checkout** is **refused** unless `--adopt` — see *The sync record* below. `--adopt` is for a card you made by hand and are deliberately adopting, and it overwrites what is there, so it is never the way to make the guard quiet. A run that parses **zero** tasks refuses to delete anything — that is a wrong `--tasks` path, not a request to empty the board.

### The sync record (the overwrite guard's baseline)

The guard has to know which ids **this edit introduced** — an id it has never synced, landing on a card already on the board, would replace another task's content. It knows from two inputs and needs at least one:

- **The record** of the ids this checkout last synced, written after every **live** run (never a dry run; a run that dies part-way still records what it did sync). It lives **inside git's own directory**, at `.git/ai-dev-workflow/sync-plane/<board>.<source>.<prefix>.json` — one per board and consumer, never in the tracked tree, so there is nothing to gitignore and a client repo in client-repo mode cannot see it. Outside a git checkout it lives under `~/.ai-dev-workflow/sync-plane/`.
- **The committed source file.** An id in it is accepted, so a card a teammate synced and committed does not refuse after you pull.

With **neither** — the first run in a checkout, or an untracked `TASK.md` before its first sync — **every id is new**, and any card already on the board is refused. That is deliberate: the old guard printed a note and ran unguarded in exactly that case. To get past it, check what adopting would change with `--dry-run --adopt`, and if every card listed is this file's own, run **once** with `--adopt`; the record is written after that run. **Deleting the record re-arms that first-run refusal.**

## Key prefixes (shared boards)

The prefix namespaces `external_id` so consumers never collide on **one** board:

| Consumer | Prefix | `external_id` (hidden, correlation) | Card title (visible) | Side label |
|---|---|---|---|---|
| backend | `BE-` | `BE-TASK-018` | `BE-018: …` | `Backend` |
| frontend | `FE-` | `FE-TASK-004` | `FE-004: …` | `Frontend` |
| product (its own follow-ups) | `PD-` | `PD-TASK-007` | `PD-007: …` | `Product` |
| infra | `IN-` | `IN-TASK-041` | `IN-041: …` | `Infrastructure` |
| the workflow master itself | `WF-` | `WF-TASK-001` | `WF-001: …` | — |

**Every side numbers its own tasks, so a shared board holds several `TASK-063`s.** The title therefore shows the short namespaced id (`BE-063`), never the bare `TASK-063` — three identical titles once made one side's card unfindable. (How tasks are named to people: [`WORKFLOW.md` → mirror Principle](../../WORKFLOW.md#task-tracker-sync--the-mirror-principle).) With no prefix the title keeps `TASK-063`. **The label should name the side** (`--side-label` / `PLANE_SIDE_LABEL`): the Category mapping alone sent backend `Documentation` cards to the `Infrastructure` label, where they read as infra's.

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
