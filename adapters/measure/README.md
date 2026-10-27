# measure — what each persona pays to start a session


Every session starts by reading its persona's start-up set: the spine, its own docs, its board, its peers' outboxes. That reading costs tokens **before any work begins**, and it grows quietly as boards and logs fill up. This adapter tells you how much, per persona, and which files dominate.

```bash
bash adapters/measure/measure-context.sh                    # every persona: total, then files largest first
bash adapters/measure/measure-context.sh --persona backend  # one persona
bash adapters/measure/measure-context.sh --tsv              # persona<TAB>tokens, for scripts
bash adapters/measure/measure-context.sh --exact            # exact counts (needs ANTHROPIC_API_KEY)
```

## Where the list comes from

A persona's start-up set is **parsed from its own `ARCHITECT.md` → Initialization** — every file a step names, by link or code span, plus `ARCHITECT.md` itself. A step reading "every other `../*/INTERFACE.md`" counts each peer's outbox, never the persona's own. A step for a workspace the project does not have counts nothing. There is deliberately no second list: edit an init step, and the meter follows.

## Estimate or exact

- **The estimate (default)** divides bytes by a ratio — **3.7 bytes per token**, overridable with `--ratio` or `MEASURE_RATIO`. It is free, instant, and identical on every run, which is what a trend needs. **Calibration:** the default is uncalibrated as of 2026-10-16 (English markdown typically lands between 3.5 and 4). With a key, run `--calibrate` once on a real project and record the ratio here, with the date.
- **`--exact`** asks Anthropic's token-counting API (`/v1/messages/count_tokens`): free, rate-limited per account tier. The key is read from `ANTHROPIC_API_KEY` by name and never printed. The model is `MEASURE_MODEL` (default `claude-sonnet-5-5`). Use it when the number itself matters, not for trends.

## What to do with the number

The largest file is usually the board. Closed cards that every session re-reads add up quickly — on one real project, `backend/TASK.md` was over 80k tokens of a ~185k start-up. That is what [`CONSOLIDATION.md`](../../CONSOLIDATION.md) exists for: run the meter, and consolidate whatever dominates.

## Task cost: what the work itself used (Claude Code)

The meter counts what a session pays before work begins. `task-cost-claude-code.js` reads what each task actually used, from Claude Code's local session logs. It is a **Binding** for that host: other hosts would get a reader of their own beside it.

```bash
node adapters/measure/task-cost-claude-code.js --project .                  # every task, most expensive first
node adapters/measure/task-cost-claude-code.js --project . --git-dir <review repo>/repo.git --git-dir .git   # client-repo mode
node adapters/measure/task-cost-claude-code.js --project . --since 2026-10-01 --json
```

**The attribution rule.** A session is not a task: one session often closes several. Each task ends with *approve* and one commit that flips its card to `COMPLETED`, and the session log records that commit as a tool call. So, within a session, **calls up to and including the commit call that closed a card belong to that card.** A subagent's calls go to the window their time falls in. Which card a commit closed comes from git (the card's `Status:` flipped, across the board and its archive), never from the commit message. A commit that closed **no** card (a review snapshot, the source half of a client-repo approve, a docs-only commit) does **not** end a window: its calls go on to the next close, and the task reports it under **other commits**, so folded-in work is visible. Calls after a session's last close are **open**. When two sessions commit close together, the closing commit goes to the **nearest** commit call.

**Per task:** tokens by kind (input, 5-minute and 1-hour cache writes, cache reads, output), a weighted total, the **average context** a call ran in, and **cold restarts** (a call after more than an hour idle, which writes the whole context again). A task costs far more late in a week-old chat, so read its tokens beside its context. **Confidence:** `high` when the commit call was found in the session and closed one card; `low` when matched by time alone, or when one commit closed several cards.

**Weighted** is input-equivalent tokens: input 1, 5-minute write 1.25, 1-hour write 2, read 0.1, output 5, as published for Claude models (checked 2026-10-22). Weights, not dollars: the ratio holds across models.

**Approximate, and what it cannot see:** server-tool usage; other hosts; sessions run on another machine; a task closed without a commit, or by a commit with no commit call in any session (matched by time, `low`); cards a project closed in batches before one-commit-per-task. It only reads, never writes, the logs or any repository.

## Quality: did it hold?

Tokens are one side of a change. The other is whether the work stayed good, and the cards already record most of that. `quality-report.js` reads a side's board **and** its `TASK_ARCHIVE.md`, so archiving cards never changes the result:

```bash
node adapters/measure/quality-report.js --tasks backend/TASK.md          # the four signals
node adapters/measure/quality-report.js --tasks backend/TASK.md --json   # the numbers, for scripts
```

- **Review findings** — material and advisory per reviewed task, from the `Review:` tail (`— 2 material / 5 advisory, 2 rounds`).
- **Review rounds** — reviewer runs per task, and which tasks needed more than one. Rising rounds mean first drafts are getting worse, or the review is looping.
- **Questions** — reviewer questions per task, from `Questions:` (`none`, `collected n`).
- **Escapes** — closed cards that a later card says it `fixes` in its `Source:`. A defect found after "done" is the one the review missed. A `fixes` naming an open card or an unknown id is listed, not counted.

The field formats are defined once, in [`WORKFLOW.md` → Canonical Task Format](../../WORKFLOW.md#canonical-task-format). Old cards are not backfilled, so each line says how many closed cards recorded it. Read a low count as "too early to tell", not "fine". Compare the report before and after a workflow change, next to the meter's numbers.
