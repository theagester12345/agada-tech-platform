# diff-open — open a task's own diffs, on request


**When several sessions share one working tree, `git diff` mixes their work,** and a reviewer cannot tell which change belongs to which task. The [finishing sequence](../../WORKFLOW.md#task-synchronization-protocol) fixes the attribution: each session lists **its own** declared files, and opens their diffs **only when you ask**. This script does the opening, the same way in every project.

```bash
bash adapters/diff-open/diff-open.sh <this task's files…>                    # against HEAD
bash adapters/diff-open/diff-open.sh --base <rev> <files…>                   # against another revision
```

## Openers

Recorded per project in [`STACK.md`](../../STACK.md) → Commands → **Diff opener**, and read from the environment so every caller agrees:

| Opener | What it does | Set by |
|---|---|---|
| `difftool` (default) | Your configured `git difftool` (`git config --global diff.tool …`), **one file at a time**. Works with any editor or diff tool. | `--opener difftool` or `DIFF_OPENER=difftool` |
| `vscode` | Your editor's diff view, **one file at a time**: `<bin> --wait --diff <base> <file>` per file, each waiting until you close it. VS Code and its forks take the same flags, so the binary is configurable (`code`, `cursor`, `codium`, …). | `--opener vscode --editor-bin <bin>`, or `DIFF_OPENER` + `DIFF_EDITOR_BIN` |

## One at a time, and it waits

**Both openers show one diff, wait for you to close it, then open the next.** Opening every diff as tabs at once flooded the editor, so that is now an explicit request — `--all-at-once` (the `vscode` opener only) — never a mode a project drifts into. When the last diff closes the script prints **"All diffs closed — collect or approve?"**, so the agent asks rather than waiting for you to remember the word.

Because it waits, a whole review can outlast how long a host lets one command run. [`STACK.md`](../../STACK.md) → Commands → **Diff opener** records how this project's host runs it so nothing is cut off — typically **in the background**, with the agent reacting when it exits.

## What it guarantees

- **The right side is always the real working file**, never a copy. A comment you type in the diff lands in the code, where the [reviewer-questions gate](../../WORKFLOW.md#the-reviewer-questions-gate-build) collects it. The left side is a read-only copy of the base.
- **A new file diffs against empty; a deleted file is listed**, never opened. An unchanged file opens nothing.
- **The base:** `--base <rev>` — `HEAD` by default, or any revision. Or `--base-dir <dir>`, base copies laid out at the same relative paths — how [`../workflow-review/wf-git`](../workflow-review/README.md) passes its last-approved versions.
- **Nothing is staged and nothing is committed.** Paths are validated before anything opens: `..`, a path outside the project, or an unknown opener is refused.
- **Config, not location:** `--project` (default: the git top level of the current directory). Nothing is derived from where the script sits — one shared copy serves every project.

The base copies stay on disk after the script exits, because a non-blocking editor reads them later; folders older than a day are pruned.

**Tests:** `bash adapters/diff-open/diff-open.test.sh` — a sandbox with a fake editor and a stub difftool; never touches a real project.
