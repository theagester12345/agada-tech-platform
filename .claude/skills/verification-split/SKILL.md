---
name: verification-split
description: 'Use when a task has acceptance criteria its own session cannot prove — a deploy, a dashboard read, an email arriving, a real device — before closing the card: split the human observation into its own verification task.'
---

<!-- Generated from skills/verification-split/SKILL.md by adapters/skills/emit-skills.sh — edit the source, not this file. -->

# Verification only a human can run — split it, don't park the card


Part of the workflow spine, kept here so it loads only when a task needs it. The rule and its trigger stay in [`WORKFLOW.md`](../../../WORKFLOW.md); this is the procedure. Edit it here — `.claude/skills/` holds generated copies.

Some acceptance criteria cannot be met by the session that wrote the code: a deploy has to happen, a dashboard has to be read, an email has to arrive, a real handset has to be held. Left on the implementing card they hold it `IN_PROGRESS` indefinitely — and a board carrying several stops distinguishing *"still being built"* from *"built, waiting on somebody to look."*

**Split the observation into its own task.** The implementing card keeps every criterion its own session can prove and closes normally; a **verification task** carries the criteria that need the human and what counts as a pass. It is the canonical [`Actor: human`](../../../WORKFLOW.md#canonical-task-format) card, and that field is where its steps, method and tool are required — one bar, stated once.

**Why a split and not a new status:** the two halves have **different actors**. An agent builds; a person deploys, watches, and reads a dashboard no agent can reach. One card cannot be owned by one actor, so it is never actually anybody's turn. A `VERIFYING` status would leave that unchanged while adding a value every tracker adapter must learn.

**This does not apply to the [review gate](../../../WORKFLOW.md#self-review-before-declaring-done-build--mandatory).** A human-only *review* still holds its task open under that section's own rule. The gate asks whether the change is sound before it is trusted; verification asks whether the shipped thing behaves. Splitting the review would let unreviewed code read as done, which is the exact failure that gate exists to prevent.

**Four conditions, all required** — without them this is a way to mark unfinished work `COMPLETED`:

1. **Criteria move; they never evaporate.** Every unmet criterion is copied onto the verification task **verbatim** before the implementing card closes. Dropping one instead is a scope change and is recorded as one.
2. **Created in the same change that closes the implementing card** — never "filed later." A verification obligation that exists only in someone's memory is the hole a board audit finds months on.
3. **Linked both ways.** The implementing card names its verification task; the verification task carries the implementing card as its `Source:`. Either direction alone can be lost in an edit.
4. **The verification task inherits at least the implementing card's priority.** Splitting must not quietly demote a Critical proof to a Normal chore nobody schedules.

**`COMPLETED` then means built and reviewed — not proven in production.** That is a real narrowing and it must be visible: the implementing card says which task holds its proof, so a later reader is never told more than was established. Where the narrowing is unacceptable — a regulated claim, a client sign-off, anything where "done" is contractual — **do not split; hold the card open.**

**Findings belong to the verification task.** What the pass turns up becomes new cards raised from it, in the ordinary way. It closes when the observation has been made and recorded — not when everything it found is fixed, which would inherit the same open-ended parking this rule removes.
