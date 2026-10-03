# adapters/questions — the reviewer-questions scanner

**Binding.** The portable rule lives in [`WORKFLOW.md` → The reviewer-questions gate](../../WORKFLOW.md#the-reviewer-questions-gate-build). This directory is the mechanism: what the spine says to do, this runs. Read the spine first — the rules about *when* to scan, what may be collected, and how markers are deleted are there, not here.

## What it does

Finds a reviewer's inline questions across the repository, collects the ones inside the file set **this session declared**, and reports every other one by path without touching it.

```sh
adapters/questions/scan-questions.sh [--marker <token>] [--exempt <path>]... <path>...
```

| Exit | Meaning |
|---|---|
| `0` | no markers in the declared set — the gate's **guard scan** passes |
| `1` | in-scope markers exist — answer them before the review gate |
| `2` | usage error (no paths, or a blank argument) |

## The two arguments that make it one copy

**`<path>...` is the declared file set, and is never inferred.** Deriving it from `git status` would, in a shared checkout, hand this session a peer session's questions — the exact failure the review gate's scoping rule exists to prevent. It is the same list the gate already makes the session write down: one list, now three readers.

**`--marker` is the token, without its comment wrapper.** `//`, `#` and `<!-- -->` are never part of it, because one baked-in wrapper silently fails in every other file type. The token is the **singular stem** and the trailing `s` is optional; matching is case-insensitive. That is not tidiness — it is typed live, mid-read, and the source project lost three singular markers before this was allowed for. **Over-matching is the safe direction:** a false positive gets read and waved past by the human it is shown to; a false negative is invisible.

**`--exempt` silences a doc that *defines* the marker** and would otherwise report itself on every run. Exempt by default: this adapter's own files, every emitted `AGENTS.md`, and `STACK.md`, where the token is recorded. **Stated cost:** a genuine question typed into one of those is not collected — write it in the code it is about.

Nothing is derived from where this script sits. That is what lets one copy serve every side, and it is the rule a `__dirname`-shaped adapter broke once before (`MOC-20260708-02`).

## The commit-time backstop

[`.githooks/pre-commit`](../../.githooks/pre-commit) refuses a commit whose **staged additions** introduce a marker, and names the file and line. Staged additions only: a marker already in history is somebody's open question but is not this commit's doing, and that asymmetry is what makes leaving review notes in source safe at all. Set `QUESTION_MARKER` if this project chose a different token.

## Tests

```sh
sh adapters/questions/scan-questions.test.sh
```

80 assertions, no dependencies. Run them after **any** change here. They are not decoration: porting this adapter into the workflow introduced two real defects — a regex that stopped matching the singular marker, and a fast pass that word-split a path containing a space — and the suite caught both. A guard that silently misses is worse than no guard, so its tests ship with it.
