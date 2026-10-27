# consolidate — move closed cards and answered outbox entries out of the start-up read


Every session reads its side's `TASK.md` at start-up. On a project that has run for a while, most of that file is `COMPLETED` cards — history that every session pays for again. On one real project the closed cards were about a third of each engineering persona's start-up cost. This script keeps the newest completed cards on the board and moves the rest to `TASK_ARCHIVE.md` beside it, which nothing reads at start-up.

```bash
node adapters/consolidate/archive-tasks.js --tasks backend/TASK.md --keep <window> --dry-run   # list what would move
node adapters/consolidate/archive-tasks.js --tasks backend/TASK.md --keep <window>             # move it
```

The window (`--keep`, default 10) has one home: [`STACK.md`](../../STACK.md) → Commands → **Archive window**. The rules are in [`CONSOLIDATION.md`](../../CONSOLIDATION.md#the-board-moves-by-script).

## What it guarantees

- **Only `COMPLETED` cards move**, wherever they sit on the board and whatever the section headings look like. Open work never moves.
- **Newest stay.** Cards are ranked by their `Completed:` date. A card with no date counts as the oldest, and equal dates keep their order in the file.
- **Each card moves as the exact text it had.** The rest of the board is left line for line; where a removal leaves two blank lines touching, one goes.
- **The tracker does not notice.** The [Plane sync](../plane/README.md) reads the archive as part of the source, so a moved card stays mirrored and a re-sync reports it *unchanged*. One exception, cosmetic and once: if the card that ends up **last** in the archive ends in a `---` rule, the sync drops that rule from its mirrored copy, as it does for the last card of any file.
- **Safe to re-run.** With nothing past the window it changes no byte. Newly archived cards go above older ones, so the archive stays newest first.
- **Nothing is lost on a crash.** The archive is written before the board. A run cut off between the two leaves a card in both files, which the sync refuses instead of deleting anything; remove the board's copy and re-run. An id already in the archive is refused before anything is written.

Node 18+, no dependencies. Every path is an argument.

**Tests (board):** `node --test adapters/consolidate/archive-tasks.test.js` — temp files only; it checks the result against the sync's own parser, so the two cannot drift apart unnoticed.

## Outboxes: `archive-outbox.js`

Every persona reads every peer's `INTERFACE.md` at start-up. This moves each outbox's closed entries to `INTERFACE_ARCHIVE.md` beside it, keeping the newest `--keep` closed entries per outbox.

```bash
node adapters/consolidate/archive-outbox.js --keep <window> --dry-run   # list what would move, per outbox
node adapters/consolidate/archive-outbox.js --keep <window>             # move it
```

- **Closed is read from both sides.** An entry moves only when every recipient's `Consumed from` marker has passed it, and, for a `REQUEST`, every recipient has posted a `RESPONSE` naming it or the entry's own status closes it (`DELIVERED`, `ACK`, `WITHDRAWN`, `SUPERSEDED`, `DECLINED`, `CLOSED`). Real outboxes leave most answered entries at `NEW`, so the status line alone is never trusted to keep one open.
- **What it cannot confirm, it leaves.** A recipient code with no outbox in the project, a marker at `<none>`, an entry with no recipient: all stay. So does any entry an open entry still names in `Re:`.
- **One run, every outbox**, all decided from the files as they were before anything moved. `--project <dir>` (default: the current directory) is the root whose `<dir>/INTERFACE.md` files are the outboxes.
- **Exact text, newest first, safe to re-run**: the same guarantees as the board script, and the archive is written before the outbox.

**One thing it cannot tell:** a `RESPONSE` posted **on receipt** ("received", "filed") looks like an answer. Since `MOC-20261016-01` responses are posted when the work is done, but an older outbox may hold receipts. The first time, read the `--dry-run` list before moving anything.

**Tests:** `node --test adapters/consolidate/archive-outbox.test.js` — a temp project with three outboxes.
