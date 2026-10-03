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

## [2026-10-03] - workflow_call boolean and recipe checkout
**Decision / Lesson:** Compare a `workflow_call` boolean with `inputs.deploy`, not `== 'true'`. Check out files that live next to a reusable workflow with `job.workflow_repository` / `job.workflow_sha`, not `github.workflow_ref`.
**Reasoning:** A `workflow_call` boolean is a real boolean, so `== 'true'` is always false and Render would never update. `github.repository` and `github.workflow_ref` are the caller; a same-repo throwaway caller hides both. GitHub’s own example for “files beside the recipe” is the `job.workflow_*` pair.
**Trigger criterion:** gotcha

---

_Last Updated: 2026-10-03_
