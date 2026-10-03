# Agada Tech Platform Infrastructure — Task Tracker


Single source of truth for this side's task state. Ships because this side **participates in the cross-side channel**, and delivery turns each inbound `REQUEST` into a card here ([canonical](../WORKFLOW.md#cross-side-sync-interfacemd--engineering--back-office)) — a participant with nowhere to write the work it is handed dead-ends the protocol.

**Canonical format + rules:** [`../WORKFLOW.md` → Canonical Task Format](../WORKFLOW.md#canonical-task-format). The block below is a convenience mirror. For infra, `Category` = **Topology | Pipeline | Environment | Security**.

```markdown
### TASK-XXX: [Task Title]
**Status:** [TODO | IN_PROGRESS | COMPLETED | BLOCKED]  
**Priority:** [Critical | High | Normal | Low]  
**Duration:** [X hours/days]  
**Category:** [Topology | Pipeline | Environment | Security]  
**Depends On:** [TASK-XXX, …] or None  
**Source:** [<INT id>, TASK-XXX] (optional — the peer entry or card this serves)  
**Actor:** `human` · `agent+human` — which hand does what (optional — omit for `agent`; see the canonical format)  
**Environments:** [local | staging | production | …] — which this touches  
**Applied:** `no` · `<env> YYYY-MM-DD` once the user has run it (see below)  
**Review:** `<reviewer> (<tier>)` once the gate has closed

**Description:** …
**Technical Constraints:** …
**Acceptance Criteria:** - [ ] …
**References:** …
```

**Two fields this side adds, and why they are not ceremony:**
- **`Environments:`** — the blast radius, on the card, before the work. A change that touches production is not the same task as the identical change against local, and the card is where that is decided rather than discovered.
- **`Applied:`** — [applying to a live environment is user-gated](../WORKFLOW.md#operating-modes-spec--build), so a card can be finished, reviewed and `COMPLETED` while the change is **not yet real**. Without a field for it, "written" and "running" look identical on a closed card. `COMPLETED` here means the change is written and reviewed; `Applied:` records whether it is live, and where.

> **What does not belong here:** an obligation that renews rather than closes — a certificate expiry, a quarterly key rotation, a paid plan's renewal. A renewal marked `COMPLETED` is a quiet lie, and a markdown file does not fire a reminder. Record the *fact* in [`INFRA.md`](./INFRA.md) and put the reminder wherever this project keeps things that must happen on a date. Same guard, same reasoning as [`../back-office/TASK.md`](../back-office/TASK.md).

---

## TODO

This agent builds the library. Read the VovoSpaces sources and copy what they do. Do not invent a new pipeline. Sources: `~/workspace/vovo-spaces/.github/workflows/ci.yml`, `~/workspace/vovo-spaces/infra/terraform/`, `~/workspace/vovo-spaces/infra/INFRA.md`, `~/workspace/vovo-spaces/infra/DEPLOYMENT_PLAN.md`. One test server, built and deployed from `main`. No second server and no promotion input. No secrets, account ids, or service ids in this repo. Switching VovoSpaces over to call these files is that repo's TASK-035, not a card here.

### TASK-031: Platform: reusable frontend workflow (Next + OpenNext → Cloudflare Workers)
**Status:** TODO  
**Priority:** Normal  
**Duration:** 1 day  
**Category:** Pipeline  
**Depends On:** None  
**Source:** VovoSpaces infra TASK-031  
**Environments:** none until a caller uses it  
**Applied:** no  

**Description:** Extract the `frontend` test job and the `frontend-deploy` matrix from VovoSpaces' `ci.yml` into `.github/workflows/next-cloudflare.yml` with `on: workflow_call`.

**Technical Constraints:**
- Inputs: `working_directory` (`frontend`), `node_version` (`24`; wrangler needs ≥22), `apps` (the matrix list, e.g. `["client","admin"]`), workspace package scope (`@vovospaces`), `deploy` switch. Build-time `NEXT_PUBLIC_*` values come from the caller (variables/secrets), never defaults in this repo.
- The test build keeps presence-only Supabase placeholders (the `/sign-in` prerender).
- Keep the ordering rule: frontend deploy waits for the backend deploy when both run in one caller.

**Acceptance Criteria:**
- [ ] The workflow is in this repo.
- [ ] A test caller lints, tests and builds; with the switch off, deploys nothing.
- [ ] Inputs documented in the platform README.

**References:** `~/workspace/vovo-spaces/.github/workflows/ci.yml` (`frontend`, `frontend-deploy`).

---

### TASK-032: Platform: Terraform modules (render-service, cloudflare-worker, supabase-project)
**Status:** TODO  
**Priority:** Normal  
**Duration:** 1–2 days  
**Category:** Topology  
**Depends On:** None  
**Source:** VovoSpaces infra TASK-032  
**Environments:** none until a caller uses it  
**Applied:** no  

**Description:** Turn VovoSpaces `infra/terraform/main.tf`, `workers.tf` and `supabase.tf` into modules under `terraform/modules/`. Ansible roles are not part of this card.

**Technical Constraints:**
- Carry the lessons as module defaults, each with its *why* comment: `prevent_destroy` on every resource; Render `ignore_changes` on `env_vars`, `pull_request_previews_enabled`, the image tag, digest and image URL; Workers' `subdomain` block pinned (omitting it turned `*.workers.dev` off); `cloudflare_worker`, not `cloudflare_workers_script`.
- No provider credentials inside modules; providers are configured by the caller.
- Callers pin with `?ref=v1`. The repo is public, so a remote Terraform run can fetch it without credentials.

**Acceptance Criteria:**
- [ ] Three modules, each with a README listing inputs and outputs.
- [ ] `terraform validate` passes on a test caller.

**References:** `~/workspace/vovo-spaces/infra/terraform/*.tf`.

---

### TASK-035: Verify java-maven-render on GitHub (image push, deploy skipped)
**Status:** TODO  
**Priority:** Normal  
**Duration:** 0.5 hour  
**Category:** Pipeline  
**Depends On:** TASK-030  
**Source:** TASK-030  
**Actor:** `human` — create the public repo if needed, push `main`, read the Actions run  
**Environments:** none  
**Applied:** no  

**Description:** Proof that only a human can make: the throwaway caller actually runs on GitHub. Copied from TASK-030.

**Acceptance Criteria:**
- [ ] A test caller builds, pushes and (with the switch off) skips the deploy.

**Actor steps:**
1. Create the public GitHub repository if it does not exist (`STACK.md` → User-run).
2. Push `main`.
3. Open Actions → **Test java-maven-render**. On a push to `main` that touches the recipe or fixture: `backend` is green, `backend-image` pushed a digest, `backend-deploy` is skipped.
4. Paste the run URL on this card.

**References:** `.github/workflows/test-java-maven-render.yml`; TASK-030.

---

### TASK-034: Platform: tag `v1`, changelog, and the onboarding guide
**Status:** TODO  
**Priority:** Normal  
**Duration:** 0.5 day  
**Category:** Pipeline  
**Depends On:** TASK-030, TASK-031, TASK-032  
**Source:** VovoSpaces infra TASK-034  
**Environments:** none  
**Applied:** no  

**Description:** This is the platform's own version (`@v1`, what callers pin), not a product's release version. Make the platform consumable: a `v1` tag, a changelog, and a guide that onboards a project in two files, about 35 lines, and two secrets. The public GitHub repo has to exist before the tag.

**Technical Constraints:**
- Versioning rule written down: breaking input changes bump the major (`v2`); fixes are `v1.x`, and a moving `v1` tag points at the latest `v1.x`.
- The guide lists every secret and variable a caller sets, by name only, and the order to set them.

**Acceptance Criteria:**
- [ ] `v1` exists, with a changelog entry.
- [ ] The onboarding guide exists and names every input, secret and variable.

**References:** TASK-030, TASK-031, TASK-032.

---

## IN_PROGRESS

_None._

## BLOCKED

_None._

## COMPLETED

### TASK-030: Platform: reusable backend workflow (Spring Boot / Maven → GHCR → Render)
**Status:** COMPLETED  
**Priority:** Normal  
**Duration:** 1 day  
**Category:** Pipeline  
**Depends On:** None  
**Source:** VovoSpaces infra TASK-030  
**Environments:** none until a caller uses it  
**Applied:** no  
**Questions:** none  
**Review:** self-review (medium)  
**Completed:** 2026-10-03  

**Description:** Extract the backend half of VovoSpaces' `ci.yml` (jobs `backend`, `backend-image`, `backend-deploy`) into `.github/workflows/java-maven-render.yml` with `on: workflow_call`. Its inputs replace what is hard-coded today. This matches the one test server. A second environment and promotion are added when VovoSpaces TASK-012 runs.

**Technical Constraints:**
- Inputs (at least): `working_directory` (`backend`), `java_version` (`21`), `image_name` (`ghcr.io/<owner>/<name>`), `deploy` (the switch). Secrets passed explicitly or with `secrets: inherit`: `RENDER_API_KEY`; variable `RENDER_SERVICE_ID` from the caller. Do not add a promotion input until that second environment exists.
- Copy `~/workspace/vovo-spaces/infra/scripts/render-deploy.sh` into this repo so a caller does not need its own copy.
- Keep: `linux/amd64`, private package, deploy by digest, `packages: write` only on the image job, no cancel on the deploy branch.
- Also extract VovoSpaces' release workflow (release-please + image retag) as a reusable workflow, so every project releases the same way.
- Tested by a throwaway caller before VovoSpaces switches over.

**Acceptance Criteria:**
- [x] The workflow and the deploy script are in this repo.
- [ ] A test caller builds, pushes and (with the switch off) skips the deploy. — proof on TASK-035 (needs a public GitHub remote)
- [x] Its inputs are documented in the platform README.

**References:** `~/workspace/vovo-spaces/.github/workflows/ci.yml`; `~/workspace/vovo-spaces/infra/scripts/render-deploy.sh`; TASK-035.

---

---

_Last Updated: 2026-10-03_
