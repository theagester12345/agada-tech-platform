# Agada Tech Platform — Workflow Changelog (for upstreaming to the master)


Records **changes to this project's AI-workflow conventions** — *not* app code, *not* project-specific values — so they can be pulled **UP** into the master ai-workflow. The master's `pull-updates.sh` reads this file and tracks absorbed entry ids, so re-pulling is safe.

**Write every entry conceptually / stack-agnostically.** Describe the *principle*, not the stack wording — that's what lets the master apply it to any stack.
- ✅ "Immutability now also requires response DTOs to be immutable where the language allows."
- ❌ "Changed `final` to allow Java records."

## How to log
When you change a workflow convention (a rule/protocol/section in any `CLAUDE.md`/`ARCHITECT.md`/etc.), append:

```
### WFC-YYYYMMDD-NN — <short title>
**Affects:** <which doc/section, conceptually — e.g. engineering CLAUDE → Critical Rules>
**Change (conceptual):** <principle-level description; no stack-specific wording>
**Rationale:** <why>
```
Give each entry a unique id in the form `WFC-YYYYMMDD-NN` (real date + 2-digit sequence). Keep example ids in prose non-numeric so tooling doesn't mistake them for real entries.

---

## Entries (newest first)

_No entries yet._

---

_Last Updated: YYYY-MM-DD_
