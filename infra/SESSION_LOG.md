# Agada Tech Platform Infrastructure — Session Log


**Canonical protocol:** [`../WORKFLOW.md` → SESSION_LOG Protocol](../WORKFLOW.md#session_log-protocol). Log only a workflow lesson, a non-obvious gotcha, or a judgement call with its rejected alternatives. **Ask *is this expensive to undo?*** — on this side the answer is yes more often than anywhere else, so the entry is usually owed.

Append entries chronologically before the `_Last Updated:_` line and bump that date.

```markdown
## [YYYY-MM-DD] - [Title]
**Decision / Lesson:** …
**Reasoning:** …
**Trigger criterion:** [workflow lesson / gotcha / judgement call]
```

---

## [2026-10-03] - onboarding lists every name, not two secrets
**Decision / Lesson:** The onboarding guide lists every secret and variable a caller sets. It does not stop at “two secrets.”
**Reasoning:** DEPLOYMENT_PLAN said onboarding was two files, about 35 lines, and two secrets. The extracted recipes need more names (`NEXT_PUBLIC_*`, Terraform tokens). Hiding them would make the first caller fail. The two files stay; the name list is complete.
**Trigger criterion:** judgement call

## [2026-10-03] - supabase-project names settings, not a project
**Decision / Lesson:** Keep the module path `terraform/modules/supabase-project` even though the resource is `supabase_settings`. Do not add `supabase_project`.
**Reasoning:** The card and the published path are `supabase-project`. Renaming after callers pin `?ref=v1` is a breaking source change. `supabase_project` would put `database_password` in state, which is the rejected alternative.
**Trigger criterion:** judgement call

## [2026-10-03] - workflow_call boolean and recipe checkout
**Decision / Lesson:** Compare a `workflow_call` boolean with `inputs.deploy`, not `== 'true'`. Check out files that live next to a reusable workflow with `job.workflow_repository` / `job.workflow_sha`, not `github.workflow_ref`.
**Reasoning:** A `workflow_call` boolean is a real boolean, so `== 'true'` is always false and Render would never update. `github.repository` and `github.workflow_ref` are the caller; a same-repo throwaway caller hides both. GitHub’s own example for “files beside the recipe” is the `job.workflow_*` pair.
**Trigger criterion:** gotcha

## [2026-10-05] - path-filtered test callers need a manual dispatch to verify
**Decision / Lesson:** To verify a test caller on GitHub, start it with **Run workflow** (`workflow_dispatch`). Do not plan on "push `main`".
**Reasoning:** The callers' `push` trigger is limited to recipe and fixture paths. A push that only changes docs starts nothing, and that looks like a broken pipeline. TASK-036's original steps assumed a push would run it.
**Trigger criterion:** gotcha

## [2026-10-05] - pin ubuntu-26.04, and take the lowest Node 24 action majors
**Decision / Lesson:** Recipes run on `ubuntu-26.04`, pinned. Each action moves to its *first* Node 24 major (checkout/setup-java/setup-node/cache v5, buildx/login v4, build-push v7), not the latest.
**Reasoning:** Rejected `ubuntu-latest`: GitHub moves it between 2026-10-19 and 2026-11-19, so for a month a caller's build lands on either image at random, with no platform release behind the change. Rejected `ubuntu-24.04`: it pins to the image being retired, so the bump is owed again soon. Rejected latest action majors (checkout v7, setup-node v7, cache v6): two or three majors of breaking changes for no gain, since only Node 24 was needed. Each chosen major's release notes and `action.yml` were checked against the inputs we pass. actionlint 1.7.12 does not know `ubuntu-26.04` or `job.workflow_repository` / `job.workflow_sha`; both are documented by GitHub (actionlint issue 705 / PR 707), so those two messages are tool lag, not defects.
**Trigger criterion:** judgement call

---

_Last Updated: 2026-10-05_
