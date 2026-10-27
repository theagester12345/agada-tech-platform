---
name: ui-mock-gate
description: 'Use before editing any application source for a UI screen whose BUILD work uses a reviewable mock (static HTML or equivalent): the UI mock design self-review, from the first mock to implementing from the approved one. Also when choosing who authors a mock.'
---

<!-- Generated from skills/ui-mock-gate/SKILL.md by adapters/skills/emit-skills.sh — edit the source, not this file. -->

# UI mock design self-review — before human approval


Part of the workflow spine, kept here so it loads only when a task needs it. The rule and its trigger stay in [`WORKFLOW.md`](../../../WORKFLOW.md); this is the procedure. Edit it here — `.claude/skills/` holds generated copies.

Sibling of the [code self-review gate](../../../WORKFLOW.md#self-review-before-declaring-done-build--mandatory): same *role* (agent catches defects before human sign-off), different *surface* (reviewable UI mock, not application diff).

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
