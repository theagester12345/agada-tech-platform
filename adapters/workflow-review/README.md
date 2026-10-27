# workflow-review — client-repo mode


**For a repo that must not carry the workflow** — client or company work, where the workflow is yours and stays off the client's history. There the workflow docs are excluded from the main repo, so your editor's source-control view cannot show an agent's edits to them, and you have nothing to review. This adapter gives you a **local review repo** instead. Its history lives **outside** the project, its work tree is the project, and it tracks only the files the main repo excludes.

**Its last commit is always the last state you approved.** The rule is in [`WORKFLOW.md` → Operating Modes](../../WORKFLOW.md#operating-modes-spec--build) → client-repo mode; this file is how to use the tool. **Repos you own don't use it** — commit the workflow docs normally.

## Setup

`scaffold.sh --private` does all of this for you. By hand:

1. Put a delimited block in the client repo's **`.git/info/exclude`** — never `.gitignore`, which is committed and would itself reveal the workflow:
   ```
   # ── AI dev workflow — private to this checkout
   /WORKFLOW.md
   /product/
   /backend/CLAUDE.md
   # ── end AI dev workflow
   ```
   That block is the **single list** of private paths: it keeps them out of the client repo and is the only thing the review repo will ever version. Only anchored, literal patterns (`/file` or `/dir/` — no globs, no `!`). Add new private paths **above** the end marker. `README.md` files stay in the client repo: every project needs one.
2. Create the review repo: `bash adapters/workflow-review/wf-git init`.
3. Approve the starting state: `bash adapters/workflow-review/wf-git commit "first approved state" <paths>`.

A file the client repo already tracks is not untracked by the exclude block — exclude rules never apply to tracked files. Remove it from tracking going forward, on your approval (`git rm --cached <file>`), and leave history alone.

## Configuration

One shared copy serves every project. Nothing is derived from where the script sits:

| Setting | Flag | Env | Default |
|---|---|---|---|
| The client checkout | `--project <dir>` | `WF_PROJECT` | the git top level of the current directory |
| Where the review repo lives | `--history-dir <dir>` | `WF_HISTORY_DIR` | `~/.ai-dev-workflow/history/<project dir name>` |

The review repo records which project it belongs to and refuses any other — two client checkouts with the same directory name would otherwise share the default history. Pass `--history-dir` to separate them.

A review repo made before this check existed records no project, so `wf-git` refuses it. Check it is the right one, then record it by hand: `git --git-dir=<history>/repo.git config wf.project <absolute project path>`. That step is manual on purpose.

## The loop

1. The agent edits workflow docs as usual.
2. **At the review stop it lists** the files it changed — `wf-git diff <declared files>` prints them and opens nothing. Diffs open **only when you ask**, one at a time: `wf-git diff --open <declared files>`.
3. **Only on your go-ahead** does it run `wf-git commit "<label>" <declared files>`. Approving the diff *is* the go-ahead; the commit stays user-gated.

Each side passes only **its own doc home plus the root shared files** — the [scope wall](../../WORKFLOW.md#workspace-scope--doc-home-vs-code-root) applies here like any other write.

```bash
W="bash adapters/workflow-review/wf-git"

$W status backend/ WORKFLOW.md STACK.md        # what changed since the last approval
$W diff backend/TASK.md WORKFLOW.md            # list what changed (opens nothing)
$W diff --open backend/TASK.md WORKFLOW.md     # the project's diff opener — only when asked
$W diff --print backend/TASK.md                # a unified diff in the terminal
$W diff --base <hash> backend/TASK.md          # against an older approval
$W commit "TASK-XXX: <what>" backend/TASK.md WORKFLOW.md   # after the go-ahead only
$W ls backend/                                 # what is approved
$W log backend/TASK.md                         # approval history
```

**`--open` uses the shared [`diff-open`](../diff-open/README.md) adapter** — the same opener the finishing sequence uses for source — with the last-approved versions on the left and the real docs on the right. Which opener (`git difftool`, or a VS Code-family editor's diff view) is recorded in `STACK.md` → Commands → **Diff opener**; no editor is named here. It finds the adapter in the project's `adapters/diff-open/`, or at `$WF_DIFF_OPEN`.

## Guarantees

- **Only workflow docs can enter.** Everything is filtered through the exclude block, so passing `backend/` never picks up `backend/src`. A missing end marker, a duplicated header, an unanchored pattern or a glob makes every command refuse.
- **Never versioned here:** files the work tree's `.gitignore` matches (a `.env` inside a workflow folder). They are skipped with a warning; if an already-approved file starts matching, `commit` refuses rather than freezing it at its old version.
- **No destructive commands, and nothing runs from config.** Only `init`, `diff`, `commit`, `status`, `ls` and `log` exist. `clean`, `checkout`, `reset`, `restore`, `stash`, `push`, `remote` are refused. Hooks, fsmonitor and the pager are disabled.
- **Paths are validated before anything runs.** A blank path, `.`, `..`, the checkout root, or a path outside it aborts the whole command.
- **A commit holds exactly the files you name.** Each command uses its own throwaway index; the commit is a compare-and-swap on `HEAD`, so if another session approved something meanwhile it fails and asks you to re-run.
- **No remote, ever.** A change the master should have travels up as a `WFC-` entry; everything else is project-specific and stays local. A pushed review repo would publish the private docs this mode exists to keep private.
- **Restoring a file:** `wf-git diff --print <file>` shows the approved version as a diff. There is deliberately no checkout.
- **Known limit:** two sessions with unapproved edits to the **same** file cannot be separated — serialize them.

**Tests:** `bash adapters/workflow-review/wf-git.test.sh` — a throwaway sandbox; never touches a real project or review repo.

Don't drive the review repo with raw `git --git-dir=…`: its work tree contains the client's source.
