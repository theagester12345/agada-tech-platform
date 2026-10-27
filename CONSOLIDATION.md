# CONSOLIDATION — keep the append-only docs lean


Append-only docs grow forever and are re-read every session — bloat costs tokens on every read and buries the signal. Periodically **distill** them. This is the *ongoing* token-hygiene layer (the complement to the one-time `scaffold.sh` fill).

**When to consolidate: measure, don't guess.** Run `bash adapters/measure/measure-context.sh`. It shows each persona's start-up cost and the files that dominate it. The file at the top of the list is the one to distill first.

## Which docs, and where stale content goes

| Doc | What to consolidate | Archive to |
|---|---|---|
| `*/SESSION_LOG.md` | merge/dedupe related lessons; drop superseded ones | `SESSION_LOG_ARCHIVE.md` (same dir) |
| `*/TASK.md` (COMPLETED) | **by script** — see [The board](#the-board-moves-by-script) below | `TASK_ARCHIVE.md` (same dir) |
| `*/INTERFACE.md` | **by script** — see [Outboxes](#outboxes-move-by-script-too) below | `INTERFACE_ARCHIVE.md` (same dir) |
| `product/PRODUCT_DECISIONS.md` (RESOLVED) | archive long-settled decisions | `PRODUCT_DECISIONS_ARCHIVE.md` |
| `product/FEATURES.md` (SHIPPED) | archive shipped features | `FEATURES_ARCHIVE.md` |

## The board moves by script

The board is usually the largest file a persona reads at start-up, and most of it is closed cards. Moving them is mechanical, so a script does it:

```bash
node adapters/consolidate/archive-tasks.js --tasks <side>/TASK.md --keep <window> --dry-run   # what would move
node adapters/consolidate/archive-tasks.js --tasks <side>/TASK.md --keep <window>             # move it
```

- **The window** is how many of the most recent `COMPLETED` cards stay on the board, by their `Completed:` date, so what just happened stays in view. Its one home is [`STACK.md`](./STACK.md) → Commands → **Archive window** (shipped as **10**, about one to two weeks of closed work); change it there, never per run. Open work never moves.
- **The board does not notice.** The tracker sync reads `TASK_ARCHIVE.md` as part of the source, so a moved card stays mirrored, unchanged. After a run, **dry-run the sync and confirm zero deletions** before going live.
- **Start-up reads `TASK.md` only.** The archive is read when history is needed, or for the closed card a bug names.
- No approval round is needed: the script moves cards and changes no text in them. Commit the board and the archive together.

## Outboxes move by script too

Every persona reads every peer's `INTERFACE.md` at start-up, so answered entries cost every side, not just their author. One run handles every outbox in the project:

```bash
node adapters/consolidate/archive-outbox.js --keep <window> --dry-run   # what would move, per outbox
node adapters/consolidate/archive-outbox.js --keep <window>             # move it
```

- **An entry has two owners, so "closed" is read from both sides**, never from its age or its own `Status:` line. It moves only when **every recipient has read it** (their `Consumed from` marker has passed it) and, for a `REQUEST`, **every recipient has answered** with a `RESPONSE` naming it, or its own status closes it (`DELIVERED`, `WITHDRAWN`, …). An entry an open one still names in `Re:` stays, so a live thread reads in one file.
- **Delivery is unaffected:** nothing moves before every recipient's marker has passed it. A task's `Source:` may then point into a peer's `INTERFACE_ARCHIVE.md`; read it there.
- The same window, from the same **Archive window** row. Commit each outbox and its archive together.

[Adapter README](./adapters/consolidate/README.md).

## When to run it

- **At session start**, the workspace agent notes any append-only doc over a soft threshold and **offers** to consolidate — rough triggers: `SESSION_LOG` > ~30 entries, `TASK.md` COMPLETED > ~40, `INTERFACE.md` ACKed > ~20.
- **On demand:** tell the agent **"consolidate <doc>"**.

## How (rules)

- **Archive, never delete.** Move stale entries to the sibling `*_ARCHIVE.md`; keep the *live* doc lean (that's the one read every session). Git already holds history; the archive keeps it human-readable.
- **Preserve ids** and never silently drop a lesson/decision — merge or move, don't erase.
- **Propose-then-approve** (everything but the board, which moves by script). These are judgment/history docs — show the before/after and get the user's OK before rewriting.
- Keep the live doc's newest, still-relevant entries; archive is reverse-chronological too.

_The `*_ARCHIVE.md` files are committed (they're history) — don't gitignore them._
