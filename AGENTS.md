> ⚙️ **EMITTED Binding** — source: [`WORKFLOW.md`](WORKFLOW.md). Same altitude as that source — see [`WORKFLOW.md` → Instruction precedence](WORKFLOW.md#instruction-precedence).
>
> **Do not hand-edit.** Change the source. Re-emit is automatic on `git commit` (pre-commit); mid-session run `adapters/agents/emit-agents.sh --force`.

# WORKFLOW — shared operating conventions (all workspaces)


The **single source** for conventions that apply to every workspace. Each side's `CLAUDE.md`/`ARCHITECT.md` **references** this instead of restating it — so changing a shared rule is **one edit here** and it applies everywhere (no backend↔frontend copy-paste, no drift). Anything stack- or side-specific lives in that workspace's own docs, not here.

---

## Instruction precedence

When two instructions disagree, **do not invent a tie-break ad-hoc.** Resolve by this ladder. It describes the design already in force (modes, scope walls, task naming, review gate) — it does not invent a new hierarchy. If applying it reveals two layers that genuinely claim the same rule in incompatible ways, that is a **design bug to surface**, not something to paper over with an ordering.

**Higher on this list constrains lower.** A lower layer may **narrow** a higher one (add MUST NOTs, tighten acceptance criteria, refuse a path the table already denies more specifically). It may **never widen** a higher one (grant a write the scope table denies, skip the review gate, treat plan-approval as BUILD authorization, or exit SPEC into source edits). Narrow-never-widen already applied to [Workspace scope](#workspace-scope--doc-home-vs-code-root); this section generalizes it across every instruction layer.

| Priority (highest → lowest) | Layer | What it governs |
|---|---|---|
| 1 | **Spine** — this `WORKFLOW.md` | Shared hard rules: modes, scope/permission table, review gate, task sync, secrets, cross-side sync |
| 2 | **Side persona docs** — that workspace's `CLAUDE.md` / `ARCHITECT.md` | Side-specific procedure, stack bindings, extra MUST NOTs |
| 2 | **`AGENTS.md` tree** (when present) | Tool-facing carrier of the **same** content: root file ≡ spine (altitude 1); per-workspace file ≡ that side's persona docs (altitude 2). **Not a second authority** |
| 3 | **Named task** — the `TASK.md` card in force | *What* to build: acceptance criteria, technical constraints, `Review:` state |
| 4 | **In-session user instruction** | Priority, clarification, and explicit protocol moves (declare mode, name the task, `DA`) |

**Same-altitude files must not disagree.** A workspace `AGENTS.md` that contradicts that side's `CLAUDE.md`/`ARCHITECT.md`, or a root `AGENTS.md` that contradicts this spine, is **content drift** — fix the source; do not pick a winner by ordering. Re-emit after editing a source so the Binding matches.
**`AGENTS.md` is an emitted Binding**, not an authored source. `scaffold.sh` (and `adapters/agents/emit-agents.sh`) compile it from this spine (root) and from each side's `CLAUDE.md` (per workspace). Edit the source — **do not hand-edit** the Binding. Re-emit is **automatic on `git commit`** when a source or `AGENTS.md` is staged (`.githooks/pre-commit`); you can also run `bash adapters/agents/emit-agents.sh --force` mid-session. See [`adapters/agents/README.md`](./adapters/agents/README.md). Adding a third tool (`.cursor/rules`, etc.) is another compile target against the **same** sources, never a new body.

**How user instruction fits.** The user directs *which* work and clarifies ambiguity **within** the layers above. Explicit mode declaration and naming a task **are** the protocol, not overrides of it. Ambiguous signals ("continue", enthusiasm, an approved plan) never widen BUILD authorization or scope — refuse and say which mode or named task is required. An explicit `DA` widens *verbosity only* because the [Communication](#communication-short-by-default) rules grant that lever; it does not widen any other boundary.

**Mode and scope are not optional rungs.** [Operating Modes](#operating-modes-spec--build) and the [permission table](#the-permission-table--canonical-for-what) remain hard boundaries at every layer below the spine — including in-session user instruction.

---

## Communication (short by default)

**Short by default.** Lead with the answer. The user should NEVER have to ask for brevity — if they do, the default has already failed.

- **Answer the question asked**, not the adjacent ones. Findings the user didn't ask for go in the docs (`TASK.md`, `INTERFACE.md`, `SESSION_LOG.md`), not the reply.
- **Report outcomes, not process.** What changed and what it means for the user — not the sequence of steps taken to get there, which the tool calls already show.
- **No unrequested structure.** Prose over headers/tables/bullet-walls; a simple question gets a one-line answer. Structure is for genuinely enumerable facts, not for looking thorough.
- **A finished BUILD task ends with a summary and the files it touched** — the one place structure is *required* rather than merely allowed. A short summary of what changed and why, then the file list as links, each marked **created / modified / deleted**. It reuses the file set the [review gate](#self-review-before-declaring-done-build--mandatory) already makes you declare: one list, two readers — the reviewer, then the user's own review — never a second list to maintain. The shape is fixed and small; it is not a licence to narrate the build.
- **Code comments carry the *why*, not the *what*** — the constraint, the trade-off, the non-obvious reason something is done this way. The code already states what it does, so a comment that narrates the line below it is not merely long: it becomes **wrong at the next edit**, while a *why* stays true. Cut narration; keep the reason. (Whatever doc-comment format the language uses is a side Binding, not a rule here.)
- **Low density, not just short.** One idea per sentence. Plain words over precise-but-heavy ones. Don't stack clauses with dashes and semicolons — break them out. A short paragraph can still be exhausting to read, so length and density are separate faults and fixing one does not fix the other.
- **Plain first, precise second — and a reference is never the explanation.** Lead with the plain-language statement of what happened or what to do, then add the precise or technical form for the reader who needs it. Both, in that order — not one or the other, and not the technical form alone because it is shorter to write. An internal id (`TASK-`, `FEATURE-`, `WFC-`, a ticket, a commit hash) is a **pointer to an argument, not the argument**: a sentence that stops meaning anything once you delete the id has not made its case. Checkable: *would this still say something to a reader who cannot open the file it names?* (Task cards, ledger entries and design docs are reference material and keep the dense, citation-heavy register — this governs **replies**, like the bullet above.)
- **Auto-expand ONLY when stakes are high** — architectural/design decisions, trade-offs, multi-step plans, or anything hard to reverse. Then give the full facts unprompted. This is a narrow exception, not a licence to expand by default.

- **DA** = force a **detailed** answer with all the facts. An explicit `DA` always wins over the default.

There is **no "short answer" shorthand** — short *is* the default, so a shorthand for it would be redundant. Don't reintroduce one.

---

## Operating Modes (SPEC / BUILD)

Every engineering session runs in ONE mode, declared at session start. The mode is a HARD boundary that overrides later ambiguous requests — if asked to act outside it, refuse and say which mode is needed. If none is declared, assume **SPEC** and say so. Both modes read the full board (`TASK.md`) and MAY run the tracker sync as the follow-through of their own `TASK.md` edits.

- **SPEC** (default): analysis, design, task breakdown. Main output = tasks written to `TASK.md` that satisfy [Canonical Task Format](#canonical-task-format). MAY read anything and edit docs + run the tracker sync. **MUST NOT** write/edit application source, add dependencies, run builds/tests/servers, or move an **implementation** task to `IN_PROGRESS`. (Each side lists its own concrete "MUST NOT" specifics.) To build, open a BUILD session.

- **BUILD**: implements tasks. The user must **name the task(s)** — BUILD never picks its own. It first reads the whole board and MAY recommend a different order; raise it and let the user decide. On the named task it **proceeds** end-to-end (code, deps, build/run/test, move `IN_PROGRESS → COMPLETED`, run the tracker sync) without re-asking — naming the task *is* the go-ahead. It **pauses to ask only** when: (a) the board suggests a different task first, (b) the spec is genuinely ambiguous, or (c) work would exceed the named task. **Never infer build/scope from ambiguous signals** ("continue", enthusiasm); never silently switch to or "improve" another task.

> **`IN_PROGRESS` claims that application source is being written** — that, plus the "no other agent is on this task" lock. So the prohibition above attaches to the **deliverable**, not to the status: a card whose whole output contains no source (a reviewable mock, a spec, a design brief, a manual test pass, a human verification) may be worked and closed in SPEC. Declare it with [`Actor:`](#canonical-task-format). **The source prohibition is independent and unchanged** — SPEC still writes no source, whatever a card's status or `Actor:` says, so a card mislabelled this way misreports state and never licenses an edit. Without this, work that is real, gated and on the critical path had nowhere honest to sit: absent from the board, or left in `TODO` while somebody was actively doing it.

**BUILD contains SPEC; SPEC does not contain BUILD.** A BUILD session MAY do anything a SPEC session may do — analyse, design, and write or refile tasks in `TASK.md` — without handing back to a separate session. The boundary exists to stop **unauthorized writes to application source**, not to stop thinking: BUILD already edits docs, moves tasks, and files newly-discovered work mid-task, so forbidding it to record a task is friction with no protective value. The containment runs **one way only** — SPEC still MUST NOT do BUILD's work, and "I noticed something worth building" never converts a SPEC session into a BUILD one.

> **Speccing a task inside BUILD does not authorize building it.** A task written mid-BUILD lands in `TODO` like any other; implementing it still requires the user to **name** it. This is the same boundary as the rule below — writing the spec is not the go-ahead, whoever wrote it and whenever.

**An approved plan authorizes the *plan*, not the *build*.** However a SPEC is signed off — a verbal "looks good," an approved plan document, an editor's or agent's built-in "plan mode" approval — that approves the **analysis**, and does **not** open a BUILD session. Implementation still requires the user to **name the task** (the rule above). Do not treat plan-approval, mode-exit, or an enthusiastic reply as the go-ahead to write code; when a SPEC is approved, confirm the task name and that BUILD is intended before touching source. This is tool-agnostic — it holds no matter how your editor or agent models "planning."

> **Version control is user-gated — never autonomous.** `git commit` and `git push` are **NOT** part of the BUILD flow. Do not commit or push on your own initiative — **not** after a task is COMPLETED, **not** after tests/build go green, **not** as a natural "finish." Completing a task ≠ permission to commit. Stop at a clean, verified working tree and **wait for the user's explicit command** to commit; treat pushing as a separate explicit command again. Naming a task authorizes the *work*, never the commit. (This applies in every mode.)

> **Commit messages describe the change — not the coding agent.** Do not add trailers or lines that attribute, advertise, or co-author the commit to the AI host or coding agent (for example a `Co-authored-by:` naming the tool). Human co-authors remain fine. When the user asks you to commit, write a normal message about *why* the change exists; leave the tool out of it. Enforcement (dependency-free, under [`.githooks/`](./.githooks/)): `prepare-commit-msg` **strips** known agent/host attribution trailers some hosts inject automatically; `commit-msg` **rejects** the commit if any remain. Same portable layer as the secret guard.

> **Applying a change to a live environment is user-gated — never autonomous.** This is the [version-control rule](#operating-modes-spec--build) above applied to the other irreversible act: writing infrastructure-as-code, a pipeline definition or an environment change is BUILD's work, and **making it real is not.** Do not run an apply, a deploy, a migration against a shared database, a DNS or certificate change, or a secret rotation on your own initiative — **not** because the task named it, **not** because the plan looks clean, **not** as the natural finish. Produce the plan (`plan`, `diff`, `validate`, a dry run — all of which BUILD may run), show what it would change, and **wait for the explicit command**. The commands this covers are listed in [`STACK.md`](./STACK.md) → Commands → **User-run**: print them for the user, never run them. Where a project has an `infra/` workspace this is that side's daily reality; where it does not, it binds whichever side owns the deploy.

> `product/` runs a single **SHAPE** mode instead (no code, no tasks, no UX) — see `product/ARCHITECT.md`.
> `infra/` runs **SPEC / BUILD** like an engineering side — infrastructure-as-code *is* source, and the plan/apply split is native to it — under the live-apply gate above. See `infra/ARCHITECT.md`.
> `back-office/` runs one of two **hats** instead — **LEGAL** (attorney-review disclaimer attaches) or **CORRESPONDENCE** (no disclaimer unless the message carries legal weight) — see `back-office/ARCHITECT.md`.

---

## The reviewer-questions gate (BUILD)

A human reviewing agent output **live** — as it streams past, not after the task closes — naturally leaves questions where they arise, as comments in the code. Meant as discussion, not a defect report. Left uncollected this has **no completeness property**: a question inside a hunk the agent's own diff-scoped attention already touches gets noticed in passing, while the identical question twenty lines away in untouched code is never seen. *"It found some"* is the expected behaviour of incidental discovery, not a malfunction, and no stricter review tier fixes it — the questions are being **discovered**, not **collected**.

**The stop is automatic; the scan is manual — conflating them is the error.** On finishing implementation the agent stops **unconditionally** and asks whether there are questions, **without scanning and without reporting a count**. Only the human can answer that. A scan at that moment reads a review still being written: a zero result means *"nothing yet,"* not *"nothing"* — and because answering deletes markers, acting on it destroys the first batch before a second scan could see the rest. The human then says **collect** (one scan across the declared file set, every marker presented as a single set, looping if the discussion raises more) or **proceed** (a silent **guard scan** that answers nothing and refuses if markers remain). Run the guard again immediately before `COMPLETED` — the review gate takes real time, and that is exactly when a live reviewer keeps reading.

**Scope it with the review gate's own rule** — scope the findings, not the reading — applied to a new artifact. What that section does not cover is what happens next: an out-of-scope marker needs a **disposition, not a mention**, because a question in a file no session touched is ordinary rather than an edge case, and a report with no owner is how a backstop gets routed around. The human picks one: file it as its own task; leave it to the session that owns that file, while that session is live; or **widen this task's declared scope** to cover it. Answering in place on a spoken "go ahead" is scope-widening by in-session consent, which [Instruction precedence](#instruction-precedence) forbids at every layer — amend the declared set first, so the review gate actually covers the edit.

**Where an answer lands** follows from what it is: a code change belongs in the code; a decision belongs on the card, or in the log when it carries rejected alternatives; a pure explanation becomes a **`why` comment at the site of the question** — the question is itself evidence that a capable reader could not tell why the code was written that way, which is the definition of a missing *why*.

**Delete markers last, as their own announced step, after discussion closes.** Never collect-and-delete in one move — that destroys the question before it is answered — and never interleave deletion with discussion, since the human may still have the file open. **Destroying a marker incidentally is not a lesser violation:** an edit that rewrites the region a marker sits in removes it as a side effect, and the next scan then reports a clean board, which is worse than an honest omission because it looks like proof there was nothing to collect. Treat any edit touching a marker's line as equivalent to collecting it — surface the question before that edit lands.

**Stamp the outcome on the card.** `Questions:` is part of [Canonical Task Format](#canonical-task-format); `none` is a real result and must be written, because a gate with no record is indistinguishable from one that never ran.

> **Binding:** the marker token, the trigger word, and the scanner live in [`adapters/questions/`](./adapters/questions/README.md) and are recorded per project in [`STACK.md`](./STACK.md) → Commands. The commit-time backstop is [`.githooks/pre-commit`](./.githooks/pre-commit), checked against **staged additions only** — a marker already in history never blocks an unrelated change, and that asymmetry is what makes leaving review notes in source safe at all.

---
## Self-review before declaring done (BUILD — MANDATORY)

After the task is implemented and the build/tests are **green**, the BUILD session **MUST** have its own diff reviewed and fix what the review **materially** flags **before** marking the task done. This is in addition to human review, never a replacement for it.

**Never close the gate on a review that did not happen.** The failure to design against is an agent *imitating* a review ad-hoc, or running a weaker stand-in, and recording the gate as satisfied — which retires the concern instead of answering it. Where the best reviewer is human-only the gate **holds the task open** instead: an honest blocked task is the correct outcome, a false pass never is. Measured once: on a money-critical change the workflow's own reviewer found one defect and missed two that strand paid orders; the host's reviewer found both.

**The reviewer is chosen by capability, not vendor** — never hard-code which host provides what, since capabilities change between releases. **Its invocation is recorded in [`STACK.md`](./STACK.md) → Commands, beside `Test` and `Lint` — one command per host this project actually uses; try the row for *this* session. Don't re-derive it per session.** Record the command to **try**, never a verdict about the host: running it is what tells you which rung you are on.

1. **A reviewer the agent can invoke itself** → run it at the tier below, passed to the recorded command (`STACK.md` says where the tier goes). Stamp `Review: <reviewer> (<tier>)`; the gate closes in-session and the task proceeds to `COMPLETED`.
2. **A better reviewer exists but is human-only / user-invocation-only** → do the work, select the tier, and **stop short of `COMPLETED`**: name the reviewer and tier for the user, stamp `Review: PENDING (<tier>)`, and leave the task `IN_PROGRESS` until the review has run and its findings are addressed. Do **not** substitute the fallback here.
3. **No reviewer at all** → run [`REVIEW.md`](./REVIEW.md), the workflow's own fallback, and close the gate — stamped `Review: fallback (<tier>)`, since a fallback pass must never look like a real reviewer's pass afterwards.

> **Case 1 means run it — do not ask first; case 2 is the only one that prompts.** Completing the BUILD task *is* the authorization to invoke a reviewer the agent can call (subagent, skill, CLI, MCP). A host skill's "when the user asks" wording is not a reason to skip the gate or demote to case 2. Conversely, a reviewer only the human can start **is** case 2 — stamp PENDING and ask. **Tell them apart by the symptom:** *asked and denied* is permission (grantable — retry once approved); *refused with no approval prompt at all* is capability (not grantable, and re-granting permission wastes a session). **A reviewer that fails to run has not run** — an error, timeout or rate-limit is neither a pass nor a discharge: retry if it looks transient, otherwise drop to the next rung and say which one you landed on.

- **No separately-billed tier is ever part of the gate** — any tier executing remotely or billing apart from ordinary session usage is never run and never proposed. Every permitted tier costs ordinary session tokens, so **there is no cost justification for skipping the gate.**
- **Per-task while the change is fresh** — never batched to a merge point, which dilutes attention across a blob and surfaces findings after code has been built on top.

**Tier by what the change *touches*, not its size.** **high** — auth/security, money/payments, data integrity/migrations/state machines, or a public API-contract change; each side lists its own high-risk modules. **medium** — everything else. **The agent selects the tier itself**: it follows from the risk surface, so it is not a question for the user.

**The gate closes over the change *this task* authored — not whatever sits in the working tree.** In a shared checkout the working diff is global and attributes nothing, so a task can close its gate on a diff it did not write, or "fix" another session's code without knowing its intent. Neither failure announces itself — the task simply reports COMPLETE.

- **Declare the file set before reviewing** — the files this session edited, from its own writes. It is self-attestation and therefore weak, but writing the list *before* the review makes an omission visible, which reconstructing attribution afterwards does not. It is the same list the [completion report](#communication-short-by-default) shows the user.
- **Scope the findings, not the reading.** The reviewer may read the whole repository — cross-file defects are the ones most worth catching — but it *reports* only against the declared set.
- **Out-of-scope findings are reported, never fixed** — recorded, attributed, and routed to the owning task or the user. They do not block this task's gate, and this session does not edit them. The rule governs who is blocked and who fixes, not what may be noticed.
- **Same file, two tasks:** review only your own hunks and say so. If they cannot be separated, the tasks were not independent and should have been serialized.
- **Prefer isolation over scoping** — a worktree or branch per session makes the diff correct by construction and needs none of the above. Residual risk either way: if neither session owns the *interaction* between two changes, nobody reviews it.

**Re-review the fixes — then stop on severity, not on count.** Fixes are new code and therefore unreviewed code, so re-run the review **scoped to the fix diff**. *"Run until there are no findings"* is not a convergence condition: a reviewer has a base rate of findings on **any** diff, so by the third round you are changing working code to satisfy speculative complaints. **Continue only while findings are material** (correctness, security, money, data integrity, contract); once what remains is advisory or stylistic, **record it and stop — don't fix it.** Which situation you are in: findings against **your fixes** mean keep going (they were rushed); findings against **original code the first pass never mentioned** are reviewer non-determinism — note them and stop. **In the human-only case this loop also blocks:** re-stamp `Review: PENDING (<tier>)` for the fix diff and wait rather than marking done on unreviewed fix code; a pass that returns no material findings replaces `PENDING` with what ran and allows `COMPLETED`. Severity is what ends the loop, in every case.

- **A regression test must be seen *red* before it is trusted green.** When a fix comes with a test, run that test against the **unfixed** code and watch it fail. A test written after the fix passes — which is not the same as a test that would have caught the bug. Author and test share assumptions, so a test can encode the defect as expected behaviour and still go green; this payload has already absorbed one instance of exactly that. Seeing it fail costs one run and is the only direct evidence the test is coupled to the defect rather than to your implementation.

**The review must be structurally independent of the author** — same model, same session, same context means the assumption that produced the defect is the assumption looking for it. Any reviewer used here must satisfy that; [`REVIEW.md`](./REVIEW.md) is the fallback that does, and is never a substitute for one the host provides.

## Task Synchronization Protocol

`TASK.md` is the single source of truth for task state; **consult and update it before and after work.**

- **Before:** read `TASK.md`; ensure no other agent is on the same task; move the task to `IN_PROGRESS`; verify its `Depends On` are `COMPLETED`.
- **During:** keep it `IN_PROGRESS` until all acceptance criteria are met; file newly-discovered tasks in `TODO` immediately in the canonical format — and sync them under the same rule as below, because a card filed mid-task is exactly where an id collides.
- **After — the finishing sequence.** Each gate states its own rule; this is the only place that states **when** it runs. Everything before step 5 exists so the reviewer sees the final state once.
  1. **Collect and answer the reviewer's questions** ([gate](#the-reviewer-questions-gate-build)).
  2. **Refresh the current-state artifacts** — [`SYSTEM_MAP.md`](./SYSTEM_MAP.md) if a module boundary or dependency moved; regenerate `schema.dbml` if the data model changed ([`STACK.md`](./STACK.md) → **Schema diagram**). A migration and the model it produces are **one change**.
  3. **Run the [review gate](#self-review-before-declaring-done-build--mandatory)** (BUILD — MANDATORY); fix what it **materially** flags. **A card with no application source does not inherit it** — there is no diff to review, the same reason [a side whose output is not code](#cross-side-sync-interfacemd--engineering--back-office) does not. That does **not** leave it ungated: the gate that governs its *deliverable* closes it instead — the [UI mock gate](#ui-mock-design-self-review--before-human-approval) where that deliverable is a reviewable mock, otherwise the human approval the card names as its acceptance — and `Review:` records **which**, because *nothing to review* and *review skipped* must not read alike on a closed card.
  4. **Close the [system structure gate](#system-structure-self-review--before-human-approval)** if the change touched edges rather than fields — runnable as early as the change is known, closed by here.
  5. Then `COMPLETED`; add `Completed: YYYY-MM-DD`; bump `_Last Updated:_`; log to `SESSION_LOG.md` only if it qualifies; run the tracker sync — **dry-run first, and read the verbs on both runs** (below).

  > The [UI mock gate](#ui-mock-design-self-review--before-human-approval) is absent by design: it gates **source edits for a screen**, not the finish — **except** where the mock *is* the card's whole deliverable, which is the one case step 3 hands it (there is no later source edit for it to gate).

> **For every task this edit added, the sync must report exactly one *create*.** Anything else is a stop. Two different failures hide behind that one sentence, and they do not look alike:
>
> - **It reports an *update*.** That id is already on the board under a card someone else wrote, and proceeding replaces the mirror-owned fields with your task's content. Renumber in the source file and re-run. (The one legitimate update-on-a-new-id is a card made by hand that you are deliberately adopting — see the [mirror Principle](#task-tracker-sync--the-mirror-principle).)
> - **It reports the same id *twice*.** Both blocks are in the source file and **neither has synced yet**, so the sync finds no existing card for either and creates two. The verb is right both times, which is why this one slips through a rule that only watches verbs. Afterwards two cards carry one id, every later run updates whichever the index happened to return, and the other is orphaned for good. Renumber one of them before any live run.
>
> An *update* on a task you did **not** just add is ordinary and needs no thought.
>
> **Read both runs.** The dry-run is a read and the live run is the write, so the race lives in the gap between them: your dry-run can honestly report a create, a peer can sync in the seconds that follow, and your live run then reports an update and overwrites them. If the update first appears on the live run, the write has already happened.
>
> **Repairing that overwrite depends on who holds the other block — and it is not symmetric.** If the peer's task is in the *same* source file you sync, renumber your own block and re-run: that run rewrites their card from their block, so the repair is complete in one step. If the peer works from their own copy of the file, your re-run only creates your card and **theirs keeps your content until they sync their own file**. Tell them, and tell them precisely that — because on their side the repair arrives as an ordinary-looking update, which the rule above otherwise invites them to wave through.
>
> **What the damage is.** Only fields the mirror owns are replaced, and every one of them regenerates from source; the source file is untouched, and tracker-only state such as comments and assignees survives. It is recoverable, and saying otherwise would be scaremongering — a rule oversold once is discounted afterwards. What makes it serious is that it is **silent**, and that two source tasks claim one card until somebody notices.
>
> **Deliberately phrased as an observation rather than a situation to recognise.** The earlier version was "re-check the next id when sessions share the file": acting on it requires classifying the moment you are in first, and filing a card does not feel like that moment. This one fires on words already on screen during a step already being taken. It is not *purely* observational — you still hold which ids your edit added, seconds earlier — and closing that remainder needs the adapter, which is why the [mirror Principle](#task-tracker-sync--the-mirror-principle) puts the requirement there.
>
> **Read the lines, not the totals.** Summary counts are identical for a routine status flip and for a collision. The only unambiguous summary is a dry-run reporting that it plans nothing at all; every other outcome has to be read line by line.

- **Choosing an id is a read-then-write race.** `TASK.md` is shared, so the highest id you saw when you started reading is not the highest when you write. Re-read the maximum immediately before writing the block — and do it *again* right before syncing, because the verb check above only catches a peer who has **already synced**; a peer who has written their block and not yet synced produces two clean creates and no warning at all.

**Recommending what to do next — name the companion, or say there isn't one.** When asked what is next, do not answer with a single task. Give the next task **and** whichever task could run alongside it in a separate session, with the reason it is safe: its `Depends On` are satisfied and its file set is **disjoint** from the first task's. That disjointness is the same predicate the [review gate](#self-review-before-declaring-done-build--mandatory) uses to scope findings — work that cannot be reviewed separately should not be run concurrently, so one test answers both questions.

> **"None" is a valid and often correct answer.** Never manufacture a companion to fill the slot. If every remaining task depends on the current one, or every candidate shares files with it, say so plainly — a fabricated pairing produces exactly the collision the scoping rule exists to prevent. Equally, if three are genuinely safe, say three; the point is to surface real parallelism, not to always return two.

- **When the review is human-only:** the task stays `IN_PROGRESS` carrying `Review: PENDING (<tier>)`. It is **not** `BLOCKED` — the work is finished, and overloading `BLOCKED` would hide genuinely-stuck tasks among review-pending ones. At session start, surface every task carrying a pending review before starting new work. Replace `PENDING` with what ran (`<reviewer> (<tier>)`) only when a human-only pass has returned **no material findings** (see the [review gate](#self-review-before-declaring-done-build--mandatory) — fix-diff re-reviews also block until then). Addressing returned findings, or running the next pending pass, requires a **BUILD** session that **names this task**.

---

## Verification only a human can run — split it, don't park the card

Some acceptance criteria cannot be met by the session that wrote the code: a deploy has to happen, a dashboard has to be read, an email has to arrive, a real handset has to be held. Left on the implementing card they hold it `IN_PROGRESS` indefinitely — and a board carrying several stops distinguishing *"still being built"* from *"built, waiting on somebody to look."*

**Split the observation into its own task.** The implementing card keeps every criterion its own session can prove and closes normally; a **verification task** carries the criteria that need the human and what counts as a pass. It is the canonical [`Actor: human`](#canonical-task-format) card, and that field is where its steps, method and tool are required — one bar, stated once.

**Why a split and not a new status:** the two halves have **different actors**. An agent builds; a person deploys, watches, and reads a dashboard no agent can reach. One card cannot be owned by one actor, so it is never actually anybody's turn. A `VERIFYING` status would leave that unchanged while adding a value every tracker adapter must learn.

**This does not apply to the [review gate](#self-review-before-declaring-done-build--mandatory).** A human-only *review* still holds its task open under that section's own rule. The gate asks whether the change is sound before it is trusted; verification asks whether the shipped thing behaves. Splitting the review would let unreviewed code read as done, which is the exact failure that gate exists to prevent.

**Four conditions, all required** — without them this is a way to mark unfinished work `COMPLETED`:

1. **Criteria move; they never evaporate.** Every unmet criterion is copied onto the verification task **verbatim** before the implementing card closes. Dropping one instead is a scope change and is recorded as one.
2. **Created in the same change that closes the implementing card** — never "filed later." A verification obligation that exists only in someone's memory is the hole a board audit finds months on.
3. **Linked both ways.** The implementing card names its verification task; the verification task carries the implementing card as its `Source:`. Either direction alone can be lost in an edit.
4. **The verification task inherits at least the implementing card's priority.** Splitting must not quietly demote a Critical proof to a Normal chore nobody schedules.

**`COMPLETED` then means built and reviewed — not proven in production.** That is a real narrowing and it must be visible: the implementing card says which task holds its proof, so a later reader is never told more than was established. Where the narrowing is unacceptable — a regulated claim, a client sign-off, anything where "done" is contractual — **do not split; hold the card open.**

**Findings belong to the verification task.** What the pass turns up becomes new cards raised from it, in the ordinary way. It closes when the observation has been made and recorded — not when everything it found is fixed, which would inherit the same open-ended parking this rule removes.

---

## Canonical Task Format

All tasks follow this structure exactly (consistency is mandatory for the tracker sync to parse them). `Category` values are **per-side** (see each `TASK.md`).

```markdown
### TASK-XXX: [Task Title]
**Status:** [TODO | IN_PROGRESS | COMPLETED | BLOCKED]  
**Priority:** [Critical | High | Normal | Low]  
**Duration:** [X hours/days]  
**Category:** [per-side]  
**Parent Task:** [TASK-XXX] (optional — subtasks only)  
**Depends On:** [TASK-XXX, …] or None  
**Source:** [FEATURE-XXX, <INT id>, or TASK-XXX] (optional — what this implements, or the card whose proof this verifies)  
**Actor:** `human` · `agent+human` — which hand does what (optional — who performs the work; omitted means `agent`, see below)  
**Questions:** `none` · `collected <n>` · `PENDING` while a reviewer's questions are outstanding (see [the reviewer-questions gate](#the-reviewer-questions-gate-build))  
**Review:** `<reviewer> (<tier>)` once the gate has closed — `fallback` names the `REVIEW.md` stand-in · `PENDING (<tier>)` while a human-only pass is outstanding · on a card with no application source, the gate that closed it instead (see the [review gate](#self-review-before-declaring-done-build--mandatory), and the [finishing sequence](#task-synchronization-protocol) step 3 for which gate that is)

**Description:** …
**Technical Constraints:** …
**Acceptance Criteria:** - [ ] …
**References:** …
```

- IDs `TASK-XXX`, zero-padded; next available.
- The sync reads `**Status:**`, not which section the block sits under — but keep blocks under the right section.
- Updating a task: preserve all fields; change only Status/date/checkboxes.
- **Every non-default `Actor:` value declares that this card's deliverable contains no application source**, and is what [SPEC](#operating-modes-spec--build) reads to work it. Optional: omitted means `agent`, so no existing card changes. **`agent+human` is one card when the two hands interleave inside a single gate loop** — the agent drafts and runs the checklist, the human supplies an input or approves, as the [UI mock gate](#ui-mock-design-self-review--before-human-approval) does by construction. **It is two cards when one half is an observation the other cannot perform** — a deploy, a dashboard read, a real handset. The build finishes, then someone looks, and that is the case [Verification only a human can run](#verification-only-a-human-can-run--split-it-dont-park-the-card) **splits** rather than labels. A card naming both actors says **which hand does what** on the `Actor:` line, so the value records a division of work rather than avoiding one.
- **A card is not specced until BUILD can start from it without hunting.** Required on the card: exact file paths (or an explicit `discover under <path>` if the read did not find them); function / type names and signatures SPEC actually saw, and how they change; ordered work steps (which file, which function, what to do, in what order); observable acceptance criteria. **On an `Actor: human` card the same bar reads in that actor's terms** — the method, the ordered steps, the tool to use, and for tool-driven work the exact input to give it. A person cannot open a file path and infer the rest, so "startable without hunting" is the identical requirement translated, not a lower one. A title-plus-wish card fails this bar. Still forbidden: inventing a new public API that product has not decided ([Lane B](#working-from-product-features--engineering-sides)); writing pseudocode the source must match line by line (a second copy of the code — it will rot); fabricating a path because SPEC never opened the file. The next bullet is a correction valve for when that card was wrong about the code — it is not a ban on naming how.
- **A spec is a hypothesis until it meets the code — the one exception to preserving all fields.** When implementation contradicts the card, the implementation wins: correct the card and record what was wrong and why. Never contort code to satisfy a spec that turned out to be wrong about the codebase, and never deviate from the card silently.
- **A card whose proof was split names the task holding it.** Where criteria only a human can satisfy moved to a verification task, the implementing card says so and that task carries this one as its `Source:` — see [Verification only a human can run](#verification-only-a-human-can-run--split-it-dont-park-the-card). No new field: the back-pointer is the existing `Source:`.
- `BLOCKED` is only for genuinely-stuck work (a gate awaiting an external action). "Needs another task first" → `TODO` with a `Depends On`.

---

## Task Tracker Sync — the mirror Principle

These rules are **tracker-agnostic** — they hold whatever board you mirror to. The concrete tool is a **Binding** that lives in an adapter, not here. Shipped adapter: [`adapters/plane/`](./adapters/plane/README.md) (Plane).

- **`TASK.md` is the single source of truth.** The tracker is a **one-way, downstream mirror** — the sync **never writes back**. If the board and `TASK.md` disagree, `TASK.md` wins.
- **After every `TASK.md` edit, run the sync: dry-run, then live.** Read both diffs per-line, under the create-vs-update rule in the [Task Synchronization Protocol](#task-synchronization-protocol). If the tracker is unreachable, note the sync is **pending** rather than skipping it.
- **Refuse duplicate source ids outright.** Two blocks in the source file carrying one id is not a collision the mirror can resolve — it creates two cards for that id, after which every run updates whichever the index returns and the other is orphaned silently. The adapter must treat a repeated id as a **parse error**, in the same class as a malformed field: refused before any write, in dry-run as much as live.
- **A one-way mirror must be able to refuse a destructive write, not merely narrate one.** An update landing on a card the source file did not author replaces mirror-owned fields with another task's content, and because the sync never reads back, the mirror cannot tell that it happened. The adapter is expected to **fail rather than proceed** here. Detecting it needs an input the adapter does not have from the source file and the board alone — "an id the local file has just introduced" requires one of: the previous revision of the source file, a record of the ids this checkout last synced, or an explicit declaration from the caller. Naming that is part of the requirement; a rule that assumes the tool can already know is aspirational rather than actionable. An override belongs with the refusal, for the one legitimate route into that state: a card created by hand and then stamped with the correlation fields, so it is deliberately adopted rather than accidentally hit. Where an adapter cannot yet do any of this, the protection is a person reading a diff — attentional — and closing it is work for **the shared adapter, not a local fork** (see the permission table: `adapters/` is read).
- **One card per task, zero duplicates:** correlate on a **deterministic `external_id`** (`<PREFIX>TASK-XXX`) plus an `external_source` that identifies this workflow — index existing issues, then update or create.
- **The mirrored card must display the source id.** Correlation fields are typically hidden by trackers, so an id stored only as `external_id` cannot be quoted, searched, or referenced in conversation — the mirror becomes unlinkable to its source. Put the id where a human reads it, normally by prefixing the card title.
- **Removal propagates.** A task deleted from the source is **deleted from the board** on the next run. The source is the single source of truth, so a card it no longer declares is stale, not extra — and leaving it makes the mirror disagree with the source **silently**, which is the failure this whole Principle exists to prevent. Dry-run must list every deletion before it happens. The one case an adapter must refuse is a source that parsed **zero** tasks: that is a misconfigured path or an unreadable file, never a request to empty the board. **And the orphan set is scoped to this consumer's own key namespace, not to the whole `external_source`** — where several sides mirror into one board they are distinguished only by their prefix, so a set scoped to the source alone makes each side propose deleting every other side's cards. The zero-task refusal cannot catch that: every file parsed plenty of tasks. Membership must be an **exact** `<prefix>TASK-<n>` match rather than a prefix-startsWith, because every id starts with the empty string — so the unprefixed consumer would otherwise claim the entire board. **So retiring a consumer has an order: clear its cards while its source file still exists.** Removal propagates per source file, so once the file is gone the sync for it never runs again and its cards stay live for good; emptying the file first does not help, because that is the zero-task refusal above. Deleting the source and hoping the board follows leaves every card it created orphaned, silently — the one failure this whole Principle exists to prevent.
- **Scoped writes:** only ever touch issues carrying our `external_source`. Cards created by hand or by another consumer are never modified and never deleted.
- **Idempotent:** a second run with no `TASK.md` change must report *unchanged* and write nothing.
- **Namespaced per consumer:** every side with a tracker uses its own key prefix (`BE-` / `FE-` / `BO-` / `IN-`; `WF-` for the workflow master) so ids never collide on a shared board. The prefix is not decoration — it is what makes a destructive pass safe, so **every write scoped "to our cards" is scoped to our *namespace*, not merely to our `external_source`**.
- **Status/Priority mapping is canonical** (see [Canonical Task Format](#canonical-task-format)); `Category` is per-side, so its label mapping is adapter configuration.

> Setup, commands, flags, and the Plane-specific mapping: [`adapters/plane/README.md`](./adapters/plane/README.md). **One adapter copy serves every workspace — never fork it per side.**

---

## SESSION_LOG Protocol

`TASK.md` captures the full task spec. `SESSION_LOG.md` is **only for what `TASK.md` can't**: log an entry ONLY when at least one holds —
1. **Workflow lesson** — a process discovery worth not repeating.
2. **Non-obvious gotcha** — a bug/surprise that took real time and isn't apparent from the code.
3. **Judgement call with rejected alternatives** — reasoning not self-evident from the diff.

**Write it at the checkpoint, not when the task ends.** A session can stop abruptly — a context limit, a crash, an interruption — and a lesson that was never written down dies with it. Append the entry when the thing happens: the decision made, the blocker hit, the surprise understood. **The checkpoint most often missed is a design choice, and one question finds it — *is this expensive to undo?*** If it is, that is a checkpoint: write it while the alternatives you rejected are still in your head, because they are the part that evaporates. A choice that is cheap to reverse rarely earns an entry; an expensive one is criterion 3 whether or not it felt like a decision at the time. The three criteria above decide *whether* to write; this decides *when*. If you cannot write files, output the entry and ask the user to paste it.

**Don't log** files changed, acceptance-criteria recaps, or routine pattern application. If you can't answer *"what would a future reader lose if I didn't write this?"*, don't write it.

```markdown
## [YYYY-MM-DD] - [Title]
**Decision / Lesson:** …
**Reasoning:** …
**Trigger criterion:** [workflow lesson / gotcha / judgement call]
```

> **Keep it lean:** when this log (or any append-only doc) grows large, consolidate per [`CONSOLIDATION.md`](./CONSOLIDATION.md) — archive stale entries, don't delete.

---

## Documentation Update Protocol

After work that changes architecture/structure, **update the affected `CLAUDE.md` section** (only that section — keep it minimal). Also:
- **Deployment / infra decisions:** if the project has an `infra/` dir, record them in `infra/INFRA.md`; else keep them in the side's `README.md`.
- **Workflow-convention changes (MANDATORY, same change):** whenever you edit a *reusable convention* — any rule/protocol/section in this `WORKFLOW.md` or in a `CLAUDE.md`/`ARCHITECT.md` that is **not** project-specific — you **MUST**, in the same change, append a conceptual `WFC-…` entry to [`WORKFLOW_CHANGELOG.md`](./WORKFLOW_CHANGELOG.md) (the `log wfc` command). Write the **principle**, stack-agnostic — not your exact wording. Treat this like the self-review gate: the edit isn't done until the entry exists. This is the **only reliable** upstream channel — `pull-updates.sh` reads these entries; a reworded rule with no `WFC-` entry is invisible to its heading-diff and never reaches the master. Skip it only for genuinely project-specific content (a persona name, a stack rule, this app's domain).
- **The file index is generated, never hand-written.** Each workspace `CLAUDE.md` carries an auto listing of the docs in its doc home between `<!-- INDEX:START -->` / `<!-- INDEX:END -->`, rewritten by `adapters/index/emit-index.sh` (and by `.githooks/pre-commit`). **Never edit inside the markers.** Curated, annotated entries go *above* them: the generated block says what exists, your table says what matters. It lists docs only — code paths are declared in [`STACK.md`](./STACK.md).
- **`AGENTS.md` Binding (same change):** whenever you edit this `WORKFLOW.md` or a workspace `CLAUDE.md`, the matching `AGENTS.md` must stay identical in substance. Prefer letting `.githooks/pre-commit` re-emit and stage it on commit; mid-session (before commit) run `bash adapters/agents/emit-agents.sh --force`. Do not hand-edit `AGENTS.md`.

---

## Workflow sync workorders (PULL / UPGRADE / HARVEST)

Scripts write a workorder; an agent applies it. **"Execute \<workorder\>" authorizes the process — not a silent jump to edits.**

Applies to: `PULL_WORKORDER.md`, `HARVEST_WORKORDER.md` (project → master), and `UPGRADE_WORKORDER.md` (master → project). (Bootstrap/adopt `WORKORDER.md` already gates doc moves behind propose-then-approve; this section is the sync channel.)

**Required sequence:**

1. **Plan (no template/project convention edits yet).** Publish a short absorb/apply plan covering: which entry ids (`WFC-` / `MOC-`) you will take; which files you expect to touch; any deliberate deviations or rejects (and why); open questions. Stop.
2. **Wait for explicit approval** of that plan (or a revised plan). Ambiguous enthusiasm, "looks good" on an earlier analysis, or naming the workorder alone does **not** skip this step once the plan exists — approve the *plan*, then implement.
3. **Implement** only what was approved; record ledger ids; delete the workorder when done.

> **Rejected alternative:** treating "execute PULL_WORKORDER.md" / "execute UPGRADE_WORKORDER.md" as permission to write immediately. That collapses review into after-the-fact regret on irreversible spine/MIT changes.

---

## Workspace scope — doc home vs code root

A workspace directory (`backend/`, `frontend/`, `engineering/`, `product/`, `back-office/`, `infra/`) is a persona's **doc home** — where its `CLAUDE.md`, `ARCHITECT.md`, `TASK.md`, `SESSION_LOG.md`, and outbox live. It is **not** necessarily where its code lives, and **the workflow never dictates code location** — the stack does. A managed platform may own a root-level directory; a framework may require its entry point at the root; a single-package repo may have no natural subdirectory at all. Moving source code to satisfy a doc layout is always the wrong trade.

**The rule:** you may write **your own doc home** and **your side's declared code paths**. You may **never** write another workspace's directory.

- **Declared code paths are recorded per side in [`STACK.md`](./STACK.md)** at bootstrap, because code location is a stack fact. Where a side has no subdirectory of its own, its paths are *the repo minus the other workspaces' doc homes* — write that out explicitly rather than leaving it implied.
- **The wall protects the other workspaces, not the repo root.** With two engineering sides it additionally walls them from each other; with one, there is no second side to wall off, so the protected directories are `product/`, `back-office/`, and any peer's doc home.
- **The narrow exceptions are unchanged:** two appends into `product/` — the `IN_ENGINEERING` feature-status flip (the handoff) and a `DEC-XXX` stub under `NEW` (the Lane-test flag), both in [Working from product features](#working-from-product-features--engineering-sides) — and **read-only** access to a peer's `INTERFACE.md` outbox (see [Cross-side sync](#cross-side-sync-interfacemd--engineering--back-office)).
- **A conventional `docs/` directory is a tolerated survivor, never a destination.** A repo that already keeps genuinely technical documentation there may go on doing so, but **no workspace ever routes content into it** — product decisions, legal documents and side-specific docs belong in their doc homes. Anything found there at bootstrap or adoption gets classified like any other loose document.
- **A side declares its own concrete paths and exceptions in its `CLAUDE.md`.** Those may **narrow** this rule, never widen it — a side can add MUST NOTs; it cannot grant itself a directory this rule denies. (Same rule, all layers: [Instruction precedence](#instruction-precedence).)

### The permission table — canonical for *what*

**This table is canonical for which paths a side may touch.** Prose — here, and in every side's `CLAUDE.md` — is canonical for *why* and *how*: it explains the intent and the procedure, but it **never states a path permission this table does not carry**. If prose and table disagree about a path, **the table wins and the prose is a bug**. This is the one canonical form; it exists because a wall written only as prose gets rationalized around, and because a table is what a per-tool permission config can be generated from.

**Most specific path wins.** The narrow-exception rows are deliberately deeper paths than the deny rows they sit under — read them as carve-outs, not contradictions.

| Target | Engineering side | Product | Back-office | Infra |
|---|---|---|---|---|
| Own doc home | **write** | **write** | **write** | **write** |
| Own declared code paths (`STACK.md` → Code paths) | **write** | *owns none* | *owns none* | **write** — pipelines, IaC, containers, deploy scripts, env templates |
| Another side's doc home | **deny** | **deny** | **deny** | **deny** |
| `product/` as a reader | **read** | *own* | **read** | **deny** — nothing about hosting is a product decision |
| `product/FEATURES.md` → a consumed feature's `Status` to `IN_ENGINEERING` + the task ids it created | **write** — the handoff, nothing else in `product/` | *own* | **deny** | **deny** |
| `product/PRODUCT_DECISIONS.md` → **append** a `DEC-XXX` stub under `NEW` | **write** — the flag, nothing else in `product/`; never edit an existing entry, never write `Options:` or `Decision:` | *own* | **deny** | **deny** |
| Own `INTERFACE.md` outbox | **write** | *not a participant* | **write** | **write** |
| A peer's `INTERFACE.md` outbox | **read** — that file only | **deny** | **read** — that file only | **read** — that file only |
| `infra/` | **read**, where the project has an `infra/` workspace — ask via a `REQUEST` `To: IN`; **write** only where it has none, in SPEC, logging the decision in this side's `SESSION_LOG.md` | **deny** | **read** — reports infra facts (data residency, subprocessors) in legal documents; never decides them | *own* |
| `STACK.md` | **write** | **read** | **read** | **write** — its own Code paths row and the deploy-related Commands rows |
| `SYSTEM_MAP.md` — current module topology | **write** | **read** | **read** | **read** — *where* it runs is `INFRA.md`; *how the software is structured* is not this side's to edit |
| `schema.dbml` — current entity model, **generated** | **write** — by regenerating it, never by hand-editing | **read** | **read** | **read** |
| Shared convention docs (`WORKFLOW.md`, `REVIEW.md`, `CONSOLIDATION.md`) | **write** — but only with a same-change `WFC-` entry, per the [Documentation Update Protocol](#documentation-update-protocol) | same | same | same |
| `WORKFLOW_CHANGELOG.md` | **write** (append) | **write** (append) | **write** (append) | **write** (append) |
| `adapters/` | **read** — configure by argument; **never fork a per-side copy** | **read** | **read** | **read** |
| `.env`, `.env.*` — values | **deny** | **deny** | **deny** | **deny** — it wires secrets by **name**; it never reads a value |
| `.env.example` — variable names | **read** | **read** | **read** | **write** (append a name) — a variable the deployment requires must be declarable |

*"Engineering side"* is one column because the rule is identical whether the repo has two sides (`backend/`, `frontend/`) or one (`engineering/`) — see [`STACK.md` → Shape](./STACK.md). With two sides, "another side's doc home" includes the peer engineering side; with one, there is no peer to deny.

**Vocabulary is `write` / `read` / `deny` — there is deliberately no `ask` tier.** A wall with a negotiable state invites negotiating it; these walls are absolute, and every legitimate crossing is already a named row. Where a host's permission system offers an `ask` state, mapping our `deny` onto it is a **Binding**-level choice, not this table's.

> **Per-tool permission config** — a host's allow/deny lists, ordered globs, per-agent modes — is an optional **Binding** you may derive from this table by hand for whichever tool you use. **None ships with this workflow**, and none is required: a tool with no permission system reads the table as documentation and regresses nothing.

---

## Cross-side sync (INTERFACE.md) — engineering + back-office

Sides that can't push to each other live sync through **one outbox each**: you write **only your own** `INTERFACE.md`; you **read your peers'** outboxes. **Participants: every engineering side, plus back-office and infra.** Each declares a short code — `BE` / `FE` / `BO` / `IN` in a two-side repo with both non-engineering participants, and one more per additional side (a second client surface, a mobile app) recorded with that side in [`STACK.md`](./STACK.md). **The peer graph is complete and derived from that set**, not written out for a known pair: your peers are every other participant, and you keep one consumed-marker per peer you read. Product does **not** participate — it stays on the feature channel (READY features), not an outbox.

- **Single-writer invariant:** each side writes only its own `INTERFACE.md`; never edit a peer's outbox — this is what prevents concurrent-writer clobbering. Engineering still **never edits `back-office/`**: to ask back-office for something (a compliance reply, a contractual obligation flowing from a decision) you write it in *your own* outbox addressed `To: BO`, and back-office reads it.
- **Addressing (`To:`):** every entry carries a `To:` field naming its recipient(s) — `FE` / `BE` / `BO` (comma-separated for several). An outbox has multiple readers now, so the address is how each reader spots the entries that are theirs.
- **Capture (kills copy-paste):** when your decision requires another side to change — an API change, *or* a business/legal/contractual ask to back-office — append a `REQUEST` (Status: NEW, with `To:`) to **your own** outbox. Never ask the user to relay it.
- **Delivery:** at session start and on **"sync"**, for **each peer's** outbox, process entries addressed `To:` you past your **per-source** "Consumed from `<side>`" marker — create a `TASK-XXX` (`Source:` = the entry id, e.g. `FE-INT-…`/`BE-INT-…`/`BO-INT-…`) for each `REQUEST`, append a `RESPONSE` to **your** outbox, and advance that source's marker. A peer's `RESPONSE` to one of *your* requests just closes the loop (mark it ACK/DELIVERED) — no new task.
- **A participant must ship the tracker this protocol tells it to write into.** Delivery turns each inbound `REQUEST` into a `TASK-XXX` in the recipient's own tracker, so any workspace named as a recipient here ships a `TASK.md` — being a participant creates the requirement, not being an engineering side. Its `Category` values and acceptance-criteria shape follow that side's work, and a side whose output is not code does not inherit the [code review gate](#self-review-before-declaring-done-build--mandatory).
- **Per-source markers:** keep one "Consumed from `<side>`" marker per peer you read — one per participant other than yourself, however many there are.
- API **shape** travels via the OpenAPI spec — reference it; keep the prose/decision in `INTERFACE.md`.

> **Consequential inbound correspondence** (an external party asks for work) is back-office's entry point to this channel: back-office **acknowledges instantly and commits to nothing**, then writes a `REQUEST` in its own outbox addressed `To:` the relevant engineering side(s). The receiving side's [Lane-test trip-wire](#working-from-product-features--engineering-sides) escalates anything needing a product decision — so back-office routes to engineering, and product still owns the policy call. Binding: `back-office/ARCHITECT.md`, in projects that scaffolded that workspace.

---

## Working from product features — engineering sides

Feature work with product-level decisions originates upstream in `product/` (read-only to you, bar the INTERFACE handoff exception). In **SPEC**, turn *Ready* features into tasks:
- Pull only features whose product `Status` is **READY** (passed the product Definition of Ready). Ambiguous / open-decision features are **not** tasked — flag them to product.
- Each task carries `Source: FEATURE-XXX`.
- As the handoff, flip the feature's `Status` to `IN_ENGINEERING` and append the created task ids — one of the two allowed writes into `product/`, the other being the Lane-test stub below.

**The Lane test — not everything comes from product.** Route each request with one question: *would backend and frontend each have to independently guess the same business rule or data shape?*
- **Yes → Lane B:** it's a feature needing a new rule / entity / product trade-off → it belongs in `product/` first. If SPEC surfaces such a decision that isn't already pinned in product docs, **stop and raise it** — never invent product policy in a task. **The flag has a vehicle:** append a `DEC-XXX` stub under `NEW` in `product/PRODUCT_DECISIONS.md` — the question, what raised it, and what it blocks; **not** options and **not** an answer, which are product's to write. Product drains `NEW` at session start. Take the id the same way you take a task id (the [read-then-write race](#task-synchronization-protocol) applies here too). The stub is the whole of the write: this side does not touch anything else in `product/`.
- **No → Lane A:** a new view of already-decided product, static content, or an internal refactor → task and build it directly; product is never opened. (The client side does its own UX/mock in SPEC — see that side's `CLAUDE.md` → Design Workflow.) **With more than one client surface, each side owns the UX of its own surface** — and one is named the **primary** in [`STACK.md`](./STACK.md), owning the canonical flows the others reference rather than restate. Without that tie-break two client sides each author a full UX doc and drift, which is the duplication principle 5 exists to stop. For UI screens that use a reviewable mock, follow [UI mock design self-review](#ui-mock-design-self-review--before-human-approval).

**Staying in sync on product changes (pull-based, no push).** Both sides read the *same* product docs, so a single decision can't drift between them. On session start and on **"sync"**, besides pulling new READY features, **re-check features you've already tasked** — you hold the back-pointer (`Source: FEATURE-XXX`), so diff each consumed feature/decision against what you built and surface any that product **revised since consumption** ("product changed FEATURE-XXX you already built — review"). The `Source` stamp is the join key; product never pushes.

---

## UI mock design self-review — before human approval

Sibling of the [code self-review gate](#self-review-before-declaring-done-build--mandatory): same *role* (agent catches defects before human sign-off), different *surface* (reviewable UI mock, not application diff).

When BUILD work for a UI screen uses a reviewable mock (static HTML or equivalent):

1. **Create or update the mock first** — do not ask for approval on an empty mock.
2. **Agent design self-review (mandatory)** — run a design checklist and **fix material findings** before showing the human. Minimum checks: adjacent sections must not share the same dominant surface; one job per section; clear primary vs secondary CTA; readable contrast; brand/palette coherence; first viewport not cluttered; primary actions tappable on small screens.
2b. **Review the mock at the narrowest width the product supports, not only at the reviewer's window width.** A layout that fails at ~375px can pass on a laptop, and the defect surfaces after ship. Same principle as presenting every rendering mode: a width the gate never looks at is a width nobody approved.
2c. **Every rendering mode the screen supports must be present on the reviewable artifact** (theme, density, contrast, RTL, …), switchable in place, so one human pass approves all modes. Modes a screen deliberately does **not** support are recorded as **exempt** on the checklist — "absent" must be distinguishable from "forgotten." Mode-specific checks belong in the Binding checklist (surfaces that separate in one mode can collapse in another; contrast must be verified per mode).
3. **Open the mock in a real browser view for the human** after that pass (and after every edit round). A path or description alone is not review.
4. **Human approval** stamps the section record — only then may application source for that screen be edited.
5. **Implement from the approved mock as visual source of truth** — match section surfaces, palette, spacing hierarchy, and CTA treatment from the mock. Do **not** reinterpret mock colors through app theme tokens when that collapses adjacent contrast or flattens bands the mock kept distinct. Map to design-system tokens only when the visual relationships stay the same; otherwise use mock literals (or extend tokens to match the mock). Before marking the UI task done, open the shipped screen and confirm it reads like the approved mock (same section rhythm — not “same idea, different wash”), in every mode the screen supports.
6. Naming the BUILD task authorizes this full loop for **that screen only**.

**Who authors the artifact is not stated above, and the choice is not neutral.** Default to an author that can run step 2 **before** handing the artifact over. The argument is feedback loops, not talent: an author that cannot execute the checklist — an external generative tool, a separate team — delivers **unreviewed** work, so the review relocates onto the human at the moment they expected to judge taste rather than hunt defects. An in-loop author also reads the real design system instead of a description of it. **The default is rebuttable, and the test is divergence rather than execution:** going outside earns its cost where the job is to be off-register — no visual language pinned yet, a deliberate break from an established rut, a different discipline — and is **not** rebutted by implementing a decided system, by a screen reusing established patterns, or by an untested belief that in-loop output will be generic. **Going outside never delegates step 2 away**: it still runs in-loop before the human sees the artifact. Each side records its own default, its rebuttal conditions, and the **evidence** for any change, in its Binding.

**External “design score” tools are not part of the gate** — optional for accessibility/contrast doubt only. Human approval remains the taste/sign-off gate; the agent pass exists so structural failures (e.g. two adjacent same-tone bands) do not depend on the human noticing them.

Side Bindings (paths, checklist file, mock folder layout) live in that side's `CLAUDE.md` → Design Workflow — they may **narrow** this section, never widen past “src before approval,” skip the agent pass, or treat theme tokens as trumping an approved mock.

---

## System structure self-review — before human approval

Sibling of the [UI mock gate](#ui-mock-design-self-review--before-human-approval): same *role* (agent catches drift before human sign-off), different *surface* — the system map, not a screen.

**It trips on edges, not fields:** a component added or removed, a dependency created or dropped, a seam moved or collapsed, an entity relationship or cardinality changed. A new field on an existing entity refreshes the artifact ([Task Synchronization Protocol](#task-synchronization-protocol)) **without** opening this gate — one that fires on every change is one nobody runs.

1. **Update the artifacts first** — [`SYSTEM_MAP.md`](./SYSTEM_MAP.md), and regenerate `schema.dbml` if entities moved. Never ask for approval on a stale map.
2. **Agent structural pass (mandatory)** — fix material findings first. Minimum checks: every component on the map exists in the code, and every significant one in the code is on the map; no edge that is not a real dependency; every seam carries the reason it exists; **this change is visible on the map**.
3. **Render it, then human approval** — a diagram they look at, re-rendered after every edit round. A path or a description is not review.

**This gate blocks `COMPLETED`, not source edits** — unlike the mock gate, where the design precedes the code. A structural change is as often *discovered* mid-build as planned, and blocking source would stall exactly that case. ([When it runs](#task-synchronization-protocol).)

Side Bindings (what counts as structural for that side, and how to render) live in that side's `CLAUDE.md` — they may **narrow** this section, never skip the agent pass, the render, or approval before `COMPLETED`.

---

## Secrets & environment

Secrets must never enter agent context. The **contract is `.env.example`** (variable **names** only); the real `.env` (values) is off-limits.

### One `.env` at the code root

**Exactly one** `.env` / `.env.example` pair for a side's runnable app — at the **code root** (where the stack's install/build runs; for a fused full-stack that is typically the repo root; for a package in a monorepo, that package's root — recorded in [`STACK.md`](./STACK.md) → Code paths). Persona **doc homes** (`engineering/`, `backend/`, `frontend/`, `product/`, `back-office/`, …) **MUST NOT** keep a second `.env` or `.env.example` for the same secrets. Dual files cause tools invoked from a doc home to load a different (often empty/stale) file than the app.

- Put app vars and shared tooling vars (tracker sync, etc.) in that **one** code-root `.env`.
- When a tool is run from a doc home (e.g. Plane sync next to `TASK.md`), point it at the code-root `.env` (`--env` / equivalent) — do not create a doc-home copy.
- Still never commit `.env` values; still only commit `.env.example` names.

### Agent rules

- **Read `.env.example`, never `.env`/`.env.*` values.** You need to know which variables exist, not their secrets. If code needs a var that's missing, add its **name** to the code-root `.env.example` and ask the user to fill `.env`.
- **Never print, paste, echo, or commit a secret value.** Refer to a secret by its variable name, not its value.
- **Run, don't read.** Commands that need env load it at runtime (dotenv / the process / the framework) — run the command; you never have to open the file to make it work.
- **Prefer no readable artifact.** The strongest, tool-agnostic protection is to keep secrets *out of a file altogether* — injected env vars, an OS keychain, or a secrets manager. Treat `.env` as a dev-only convenience; when it exists, it is **untrusted-by-agents**.

**Enforcement is portable, not tool-specific.** `.env`/`.env.local`/`.env.*.local` are gitignored, and a dependency-free **pre-commit hook** ([`.githooks/pre-commit`](./.githooks/pre-commit), wired via `git config core.hooksPath .githooks`) blocks committing a real env file or an obvious secret — it fires on **any** `git commit`, whichever agent made the change. For thorough scanning add [gitleaks](https://github.com/gitleaks/gitleaks). Per-tool permission bindings (e.g. a Claude `Read(**/.env*)` deny, a Cursor ignore) are **optional add-ons** — the Binding to this portable Principle — never a replacement for it, and never part of the base.

---

_Shared spine. Change a rule here once — it applies to every workspace._
