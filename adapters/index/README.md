# adapters/index — the auto file index (a Binding)

Regenerates a listing of the docs present in each workspace doc home, inside markers in that
workspace's `CLAUDE.md`.

```bash
bash adapters/index/emit-index.sh            # rewrite the index in every workspace CLAUDE.md
bash adapters/index/emit-index.sh --target . # explicit project root
```

## The contract

- **Inside the markers is machine-written.** Every run overwrites it. Never hand-edit there.
- **Curated, annotated entries go above the markers.** That half is yours — a table of key docs with
  a one-line "what it's for" — and regeneration never touches it. The generated block answers
  *what exists*; your table answers *what matters*.
- **A file opts in by carrying both markers.** One marker alone is malformed and is skipped with a
  warning rather than rewritten, since rewriting would swallow the rest of the file.
- **`AGENTS.md` is never listed.** It is a Binding compiled from `CLAUDE.md` and it is written
  *after* this runs, so listing it would make the index alternate between two states rather than
  settle.
- **Docs only, never code paths.** Code location is declared per side in `STACK.md` and can run to
  thousands of files. This index exists so an agent can see which *docs* are present without
  listing directories.

## Ordering

Run this **before** `adapters/agents/emit-agents.sh`. `AGENTS.md` is compiled from `CLAUDE.md`, so
emitting agents first bakes a stale index into the Binding. `.githooks/pre-commit` runs them in that
order, and `scaffold.sh` does the same at bootstrap.

## Why a script and not the agent

The listing is deterministic — the script does it (the hybrid split). Judging which docs matter and
why is semantic — the agent writes that, above the markers.
