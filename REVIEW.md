# REVIEW — the fallback review procedure


**This is the reviewer of last resort.** [`WORKFLOW.md` → Self-review before declaring done](./WORKFLOW.md#self-review-before-declaring-done-build--mandatory) selects a reviewer **by capability, best-available first**. Use this procedure **only when the host provides no code reviewer at all** — not as a substitute for one it does provide, and not to close a gate faster.

**Why the restriction is load-bearing.** A workflow-owned reviewer is measurably weaker than a maintained first-party one, and running the weaker one *and recording the gate as satisfied* is worse than recording nothing: it launders an unreviewed diff as reviewed, and retires the concern. Where a better reviewer exists but the agent cannot invoke it, the task stays open with `Review:` pending — it does **not** fall back to this file.

---

## Independence is the point

"The agent reviews its own diff" is not a control unless the review is **structurally independent of the author**. Same model, same session, same context means the assumption that produced the defect is the assumption looking for it — a second read-through mostly re-derives the original reasoning and returns clean.

So: every lane below runs in **fresh context**, and the agent that wrote the code never scores its own findings.

## The lanes (run in parallel, one pass each)

| Lane | Looks for |
|---|---|
| **Conventions** | Violations of this project's `CLAUDE.md` / `WORKFLOW.md` rules |
| **Shallow bug scan** | Defects in the **changed lines only** — null/undefined, error paths, off-by-one, unhandled cases |
| **History** | What revision history and blame say about this code's past |
| **Prior decisions** | Earlier changes and recorded decisions touching these files — is a fix being silently reverted, a decision contradicted? |
| **In-code guidance** | Compliance with instructions written in the code's own comments |

**History and prior-decisions are the lanes a single self-pass reliably misses.** They are the reason this is a fleet and not a checklist.

## Scoring

A **separate** agent scores each finding against a fixed rubric. Then:

- **Confidence ranks a finding — it never deletes one.** Low-confidence findings are demoted and marked **unverified**, still reported. False negatives cost far more here than false positives, so a discard threshold is the wrong instrument: it optimizes precision in a job that needs recall.
- **Convergence across independent lanes outranks a confidence score.** Where scorers disagree sharply, lane agreement is the better evidence. (This rule exists because two scorers once split 75/0 on the only genuine defect in a money-critical change — and the lanes had it right.)
- On the **high** tier, add redundancy: multiple independent scorers — **keep a finding if *any* clears the bar** — and a refutation round against each survivor.

## Published false-positive list

Do **not** report: pre-existing issues on untouched lines · style nitpicks · anything the linter, typechecker, or test suite already catches · speculative "could be a problem if" without a path to it. Precision comes from this rule, not from taste.

## Tiering

Tiers (`high` / `medium`) and how to choose one are canonical in [`WORKFLOW.md` → the review gate](./WORKFLOW.md#self-review-before-declaring-done-build--mandatory) — they apply to **every** reviewer, not just this one, so they are not restated here.

---

## Porting, not copying

When the method you need exists but is bound to the wrong input (a hosted service, a forge pull request, a vendor integration), **port its orchestration, not its plumbing** — the value is the fleet-plus-scoring structure, not the transport. Record which parts you changed deliberately, so a later reader can tell an intentional deviation from drift.

---

_The reviewer of last resort. If your host has a real one, use that instead._
