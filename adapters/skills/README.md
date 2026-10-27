# skills emit — on-demand procedures, copied to where a host loads them


Every session reads the whole spine at start-up. A few of its procedures are needed only by some tasks, and they cost every session their full length anyway. Those procedures live in [`skills/`](../../skills/) as **skills**, in the open skill format (a `SKILL.md` with a `name` and a `description`). A host that supports skills loads only each description at start-up and the body when a task needs it. **The spine keeps each rule and its trigger in one sentence**, with a link to the body, so the rule is always in context and a host without skills still reaches the procedure by following the link.

| Authored source (edit these) | Emitted Binding (do not hand-edit) | Host |
|---|---|---|
| `skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` | Claude Code |

```bash
bash adapters/skills/emit-skills.sh --force    # regenerate every copy; remove copies whose source is gone
```

`scaffold.sh` runs it after the AGENTS emit, and `.githooks/pre-commit` re-runs it with `--force` and stages the result whenever anything under `skills/` is staged. You rarely need to run it by hand.

## What it guarantees

- **One source.** Each copy is the source with a generated note after its frontmatter, and with links to the project root rewritten one level deeper so they still resolve. Never edit a copy; edit `skills/<name>/SKILL.md`.
- **The standard's rules are checked.** A source without frontmatter, without a `description`, or with a `name` that is not lowercase-hyphenated or does not match its folder is refused.
- **A skill the project wrote itself is never touched.** Only copies carrying the generated note are regenerated or removed.

## What moves to a skill, and what never does

A procedure qualifies when **its trigger is explicit** — a named situation the one-sentence rule can state ("before editing a screen's source", "when the user says `reload`"), so the rule tells the agent exactly when to load the body. **The review gate and the finishing sequence never move:** they are needed at every finish, and a skipped gate is the failure the workflow exists to prevent.

## Adding a host

The format is shared; only the location differs. A host is one more target in `emit-skills.sh`, writing the **same** sources to its location — never a second authored copy. Add one only for a host this project is actually used under, once its location is confirmed.

**Tests:** `bash adapters/skills/emit-skills.test.sh` — a sandbox; never touches a real project.
