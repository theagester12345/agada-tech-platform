# Agada Tech Platform Infrastructure — Task Tracker


Single source of truth for this side's task state. Ships because this side **participates in the cross-side channel**, and delivery turns each inbound `REQUEST` into a card here ([canonical](../WORKFLOW.md#cross-side-sync-interfacemd)) — a participant with nowhere to write the work it is handed dead-ends the protocol.

**The format and its rules:** [`../WORKFLOW.md` → Canonical Task Format](../WORKFLOW.md#canonical-task-format). For infra, `Category` = **Topology | Pipeline | Environment | Security**, and a card carries **two fields more**, after `Actor:`:

```markdown
**Environments:** [local | staging | production | …] — which this touches  
**Applied:** `no` · `<env> YYYY-MM-DD` once the user has run it
```

**Why they are not ceremony:**
- **`Environments:`** — the blast radius, on the card, before the work. A change that touches production is not the same task as the identical change against local, and the card is where that is decided rather than discovered.
- **`Applied:`** — [applying to a live environment is user-gated](../WORKFLOW.md#operating-modes-spec--build), so a card can be finished, reviewed and `COMPLETED` while the change is **not yet real**. Without a field for it, "written" and "running" look identical on a closed card. `COMPLETED` here means the change is written and reviewed; `Applied:` records whether it is live, and where.

> **What does not belong here:** an obligation that renews rather than closes — a certificate expiry, a quarterly key rotation, a paid plan's renewal. A renewal marked `COMPLETED` is a quiet lie, and a markdown file does not fire a reminder. Record the *fact* in [`INFRA.md`](./INFRA.md) and put the reminder wherever this project keeps things that must happen on a date. Same guard, same reasoning as the legal workspace's tracker, where a project has one.

---

## TODO

This agent builds the library. Read the VovoSpaces sources and copy what they do. Do not invent a new pipeline. Sources: `~/workspace/vovo-spaces/.github/workflows/ci.yml`, `~/workspace/vovo-spaces/infra/terraform/`, `~/workspace/vovo-spaces/infra/INFRA.md`, `~/workspace/vovo-spaces/infra/DEPLOYMENT_PLAN.md`. One test server, built and deployed from `main`. No second server and no promotion input. No secrets, account ids, or service ids in this repo. Switching VovoSpaces over to call these files is that repo's TASK-035, not a card here.

### TASK-042: Verify and release next-cloudflare `v1.1.0` on GitHub
**Status:** TODO  
**Priority:** Normal  
**Duration:** 15 minutes  
**Category:** Pipeline  
**Depends On:** TASK-041  
**Source:** TASK-041  
**Actor:** `agent+human` — the user pushes and tags; the agent reads the run and the tags and drafts the reply  
**Environments:** the GitHub repo; every caller pinned to `@v1`  
**Applied:** no  

**Description:** The proof TASK-041 cannot make itself: its change on GitHub, and the release. Criteria copied verbatim from TASK-041.

**Acceptance Criteria:**
- [ ] `Test next-cloudflare` is green on GitHub after the push: `frontend` green, `frontend-deploy` skipped. It cannot set the variable, which is the "never set" case the constraint protects.
- [ ] `v1.1.0` tagged and `v1` moved to it (user-run). Reply to VovoSpaces with the tag, its commit, and "named variable: set repo variable `NEXT_PUBLIC_CLIENT_URL`; no `ci.yml` change".

**Actor steps:**
1. User: `git push` (the push touches `next-cloudflare.yml`, so `Test next-cloudflare` starts on its own).
2. Agent: read the run through `STACK.md` → Read-only ops; both jobs as above.
3. User, only after step 2 is green: `git tag -a v1.1.0 -m "v1.1.0"`, `git tag -f v1 v1.1.0`, `git push origin v1.1.0`, `git push -f origin v1`.
4. Agent: confirm both tags with `git ls-remote`, date the CHANGELOG entry, close this card, and draft the reply for VovoSpaces.

**References:** TASK-041; `CHANGELOG.md` → v1.1.0; `STACK.md` → User-run.

---

## IN_PROGRESS

_None._

## BLOCKED

_None._

## COMPLETED

### TASK-041: next-cloudflare: pass optional `NEXT_PUBLIC_CLIENT_URL` to the deploy build (v1.1.0)
**Status:** COMPLETED  
**Priority:** Normal  
**Duration:** 1 hour  
**Category:** Pipeline  
**Depends On:** None  
**Source:** VovoSpaces infra IN-062 / FE-INT-20261026-02 (relayed by the user, 2026-10-27)  
**Environments:** none in this repo; every caller pinned to `@v1`  
**Applied:** no  
**Questions:** none  
**Review:** self-review (medium) — 0 material / 5 advisory, 1 round  
**Completed:** 2026-10-27  

**Description:** VovoSpaces' admin app reads `NEXT_PUBLIC_CLIENT_URL` (the public site's address, for a "View client site" link). Next inlines `NEXT_PUBLIC_*` at build time, and a caller cannot add env to a reusable-workflow call, so only the recipe can pass it.

**Route (decided): a named variable, not a generic pass-through input.**
- *Why named:* it matches how the recipe already passes `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SUPABASE_URL`, so a caller sets one repo variable and changes no `ci.yml`.
- *Rejected — a generic input* (for example multi-line `KEY=VALUE` written to `$GITHUB_ENV`): every caller's `ci.yml` changes, and the recipe takes on an env-injection surface that needs a `NEXT_PUBLIC_` allow-list and tests. Revisit only if a second extra variable is requested, at which point the input pays for itself.
- *Version:* `v1.1.0`, not `v1.0.x`. This is new behaviour (the recipe reads a new caller variable), not a fix. CHANGELOG's rule allows an additive change in `v1.x`, and VovoSpaces calls `@v1`, so the number does not change what it has to do.

**Technical Constraints:**
- `.github/workflows/next-cloudflare.yml`, job `frontend-deploy`, step **Build and deploy**, `env:` gains `NEXT_PUBLIC_CLIENT_URL: ${{ vars.NEXT_PUBLIC_CLIENT_URL }}`, beside `NEXT_PUBLIC_API_URL`. Add one *why* comment: it is optional, and unset is an empty string the caller's app treats as "hide the link".
- **Not** added to **Check build variables are set**. A caller that never sets it must build exactly as today.
- It reaches every app in the matrix; apps that do not read it ignore it.
- The `frontend` test job is unchanged (its build uses presence-only placeholders; this variable is not required).
- Docs: `README.md` next-cloudflare table (a row: `variable`, `NEXT_PUBLIC_CLIENT_URL`, optional, caller variable); `ONBOARDING.md` §1 (optional variable, after `NEXT_PUBLIC_SUPABASE_URL`); `infra/INFRA.md` → Secrets & config (row, class public, optional); `CHANGELOG.md` `v1.1.0`.

**Acceptance Criteria:**
- [x] The deploy step passes `NEXT_PUBLIC_CLIENT_URL` from the caller's variables; the presence check is unchanged.
- [ ] `Test next-cloudflare` is green on GitHub after the push: `frontend` green, `frontend-deploy` skipped. It cannot set the variable, which is the "never set" case the constraint protects. — moved to TASK-042.
- [x] README, ONBOARDING, INFRA.md and CHANGELOG `v1.1.0` updated.
- [ ] `v1.1.0` tagged and `v1` moved to it (user-run). Reply to VovoSpaces with the tag, its commit, and "named variable: set repo variable `NEXT_PUBLIC_CLIENT_URL`; no `ci.yml` change". — moved to TASK-042.

**Proof:** the two criteria that need the user's push and tag are on TASK-042.

**References:** `.github/workflows/next-cloudflare.yml` (job `frontend-deploy`, steps **Check build variables are set** and **Build and deploy**); `README.md` → `next-cloudflare`; `ONBOARDING.md` §1; `infra/INFRA.md` → Secrets & config.

---

### TASK-040: Protect `main` on the platform repo
**Status:** COMPLETED  
**Priority:** Normal  
**Duration:** 15 minutes  
**Category:** Security  
**Depends On:** None  
**Source:** VovoSpaces infra TASK-007 (item moved here 2026-10-05)  
**Actor:** `human` — the repo owner changes a GitHub setting  
**Environments:** the GitHub repo `theagester12345/agada-tech-platform`  
**Applied:** GitHub repo 2026-10-05  
**Questions:** none  
**Review:** human observation — the card's decisions were the deliverable; no source  
**Completed:** 2026-10-05  

**Description:** `GET https://api.github.com/repos/theagester12345/agada-tech-platform/branches/main` returns `"protected": false` (read 2026-10-05). The repo is public, so branch protection is free. Protect `main` against force-pushes and deletion.

**Decisions (made on the card, before the click):**
- **No required status checks, for now.** Both test callers are path-filtered. A required check that a change does not trigger never reports, so a docs-only PR would wait on it forever. Revisit only if the callers lose their path filters.
- **No "require a pull request"; the owner may still push to `main` directly.** Release commits and tags are pushed by hand today (`STACK.md` → User-run). Requiring PRs would block that, and the release process would have to change first. That is not worth it for a single-owner repo.
- **Tags are out of scope.** `v1` is a moving tag pushed with `-f`. A tag ruleset would have to exempt it, so do not add one here.
- **Classic rule, not a ruleset.** The done-check reads the branch API's `protected` field, which a classic rule sets reliably.

**Acceptance Criteria:**
- [x] The API call above returns `"protected": true`.
- [x] A force-push to `main` and deleting `main` are both refused (the rule's defaults; no need to try them).

**Actor steps:**
1. Open https://github.com/theagester12345/agada-tech-platform/settings/branches → **Add classic branch protection rule**.
2. Branch name pattern: `main`.
3. Leave every box unticked. Unticked "Allow force pushes" and "Allow deletions" is what blocks them. Do not tick "Require a pull request" or "Require status checks" (see Decisions).
4. **Create**. Then tell the agent, which reads the API and closes this card.

**Result (read 2026-10-05):** the branch API returns `"protected": true`, `required_status_checks.enforcement_level: "off"`, no contexts. That matches the decisions above.

**References:** `STACK.md` → User-run ("Branch protection on `main`"); VovoSpaces infra TASK-007.

---

### TASK-038: Recipes: move off Node 20 actions and pin the runner image
**Status:** COMPLETED  
**Priority:** High  
**Duration:** 2 hours  
**Category:** Pipeline  
**Depends On:** None  
**Source:** TASK-036  
**Environments:** none in this repo; every caller pinned to `@v1`  
**Applied:** no  
**Questions:** none  
**Review:** self-review (medium) — 2 card-format findings, fixed; no code findings  
**Completed:** 2026-10-05  

**Description:** The TASK-036 run (https://github.com/theagester12345/agada-tech-platform/actions/runs/37312430650) raised two annotations against the recipes. (1) Warning: `actions/cache@v4`, `actions/checkout@v4`, `actions/setup-node@v4` target Node 20 (as do `actions/setup-java@v4` and the Docker v3/v6 actions) and are being forced onto Node 24. (2) Notice: `ubuntu-latest` migrates to Ubuntu 26 from **2026-10-19**. Every caller on `@v1` inherits both, so this is a `v1.x` fix, not a caller change.

**Technical Constraints:**
- Bump only to action majors whose release notes declare Node 24; keep inputs unchanged so it stays a `v1.x` fix.
- Runner: decide between pinning `ubuntu-24.04` (stable now, needs a later bump) and staying on `ubuntu-latest` after proving the recipes on Ubuntu 26. Record the choice in `infra/SESSION_LOG.md` with the rejected option.
- **Spec correction (2026-10-05):** the runner is pinned to `ubuntu-26.04`, a third option the card did not name. GitHub's notice (runner-images issue 14748) offers that label, and its rollout runs 2026-10-19 → 2026-11-19, so `ubuntu-latest` would land callers on either image at random for a month. Both named options are rejected in `infra/SESSION_LOG.md` (2026-10-05).
- Files: `.github/workflows/java-maven-render.yml`, `.github/workflows/next-cloudflare.yml`, `.github/workflows/java-maven-release.yml` (check its `runs-on` and actions too).
- Both throwaway callers must re-run green; `v1` must move to the new `v1.x` (TASK-037 tags first).

**Acceptance Criteria:**
- [x] No Node 20 deprecation warning on either test caller run.
- [x] Runner choice made, written in `INFRA.md` → CI/CD, and both test callers green on it.
- [x] `CHANGELOG.md` has a `v1.x` entry.

**Runs (push `2ae6b9c`, all jobs on `ubuntu-26.04`, zero annotations):** https://github.com/theagester12345/agada-tech-platform/actions/runs/37317746443 (backend: verify green, image pushed, deploy skipped) and https://github.com/theagester12345/agada-tech-platform/actions/runs/37317746521 (frontend: lint + build green, deploy skipped). Released as `v1.0.1`; `v1` moved to it. Not proven here: the v7 `digest` output reaching Render, since no test caller deploys.

**References:** TASK-036 run annotations; https://github.com/actions/runner-images/issues/14748.

---

### TASK-037: Tag platform `v1` on the public GitHub repo
**Status:** COMPLETED  
**Priority:** Normal  
**Duration:** 0.5 hour  
**Category:** Pipeline  
**Depends On:** TASK-034  
**Source:** TASK-034  
**Actor:** `human` — create the public repo if needed, push `main`, create and push the tags  
**Environments:** none  
**Applied:** no  
**Questions:** none  
**Review:** human observation  
**Completed:** 2026-10-05  

**Description:** Proof that only a human can make: the moving `v1` pin exists on the public repo. Copied from TASK-034.

**Acceptance Criteria:**
- [x] `v1` exists, with a changelog entry.

**Actor steps:**
1. The public repo exists (TASK-035) and `CHANGELOG.md` is already on `origin/main`. Commit and push any pending doc changes first, so the tag sits on the latest `main`.
2. Confirm `git status` is clean and `main` matches `origin/main`.
3. Run the User-run tag commands from `STACK.md`: `git tag -a v1.0.0 -m "v1.0.0"` then `git tag -f v1 v1.0.0` then `git push origin v1.0.0 v1`.
4. Paste the tag URLs on this card.

**Tags:** https://github.com/theagester12345/agada-tech-platform/releases/tag/v1.0.0 and https://github.com/theagester12345/agada-tech-platform/tree/v1 — both on `b3f11cf`, checked with `git ls-remote`.

**References:** `CHANGELOG.md`; `STACK.md` → User-run; TASK-034.

---

### TASK-036: Verify next-cloudflare on GitHub (lint/test/build, deploy skipped)
**Status:** COMPLETED  
**Priority:** Normal  
**Duration:** 0.5 hour  
**Category:** Pipeline  
**Depends On:** TASK-031  
**Source:** TASK-031  
**Actor:** `human` — start the run from the Actions tab, read it, paste the URL  
**Environments:** none  
**Applied:** no  
**Questions:** none  
**Review:** human observation  
**Completed:** 2026-10-05  

**Description:** Proof that only a human can make: the throwaway frontend caller actually runs on GitHub. Copied from TASK-031.

**Acceptance Criteria:**
- [x] A test caller lints, tests and builds; with the switch off, deploys nothing.

**Actor steps:**
1. The public repo exists (TASK-035) and `main` is pushed.
2. Open https://github.com/theagester12345/agada-tech-platform/actions/workflows/test-next-cloudflare.yml → **Run workflow** → branch `main` → **Run workflow**.
3. In that run: `frontend` is green (lint, test, build). `frontend-deploy` is skipped.
4. Paste the run URL on this card.

**Run:** https://github.com/theagester12345/agada-tech-platform/actions/runs/37312430650 (dispatch on `c35fb8f`). `frontend — lint + build` green, `frontend-deploy` skipped. Annotations (Node 20 deprecation, `ubuntu-latest` → Ubuntu 26) filed as TASK-038.

**Spec correction (2026-10-05):** the original steps said "push `main`". That does not start this caller: its `push` trigger is path-filtered to the recipe and fixture, and no push since the repo went public touched them (the public API listed zero runs). `workflow_dispatch` is the trigger that works without a code change.

**References:** `.github/workflows/test-next-cloudflare.yml`; TASK-031.

---

### TASK-035: Verify java-maven-render on GitHub (image push, deploy skipped)
**Status:** COMPLETED  
**Priority:** Normal  
**Duration:** 0.5 hour  
**Category:** Pipeline  
**Depends On:** TASK-030  
**Source:** TASK-030  
**Actor:** `human` — create the public repo if needed, push `main`, read the Actions run  
**Environments:** none  
**Applied:** no  
**Questions:** none  
**Review:** human observation  
**Completed:** 2026-10-04  

**Description:** Proof that only a human can make: the throwaway caller actually runs on GitHub. Copied from TASK-030.

**Acceptance Criteria:**
- [x] A test caller builds, pushes and (with the switch off) skips the deploy.

**Actor steps:**
1. Create the public GitHub repository if it does not exist (`STACK.md` → User-run).
2. Push `main`.
3. Open Actions → **Test java-maven-render**. On a push to `main` that touches the recipe or fixture: `backend` is green, `backend-image` pushed a digest, `backend-deploy` is skipped.
4. Paste the run URL on this card.

**Run:** https://github.com/theagester12345/agada-tech-platform/actions/runs/37217543137 (push `31f5012`). `backend` green, image pushed, deploy skipped. Earlier dispatch https://github.com/theagester12345/agada-tech-platform/actions/runs/37217022204 verified `backend` only.

**References:** `.github/workflows/test-java-maven-render.yml`; TASK-030.

---

### TASK-034: Platform: tag `v1`, changelog, and the onboarding guide
**Status:** COMPLETED  
**Priority:** Normal  
**Duration:** 0.5 day  
**Category:** Pipeline  
**Depends On:** TASK-030, TASK-031, TASK-032  
**Source:** VovoSpaces infra TASK-034  
**Environments:** none  
**Applied:** no  
**Questions:** none  
**Review:** self-review (medium)  
**Completed:** 2026-10-03  

**Description:** This is the platform's own version (`@v1`, what callers pin), not a product's release version. Make the platform consumable: a `v1` tag, a changelog, and a guide that onboards a project in two files, about 35 lines, and two secrets. The public GitHub repo has to exist before the tag.

**Technical Constraints:**
- Versioning rule written down: breaking input changes bump the major (`v2`); fixes are `v1.x`, and a moving `v1` tag points at the latest `v1.x`.
- The guide lists every secret and variable a caller sets, by name only, and the order to set them.

**Acceptance Criteria:**
- [x] `v1` exists, with a changelog entry. — proof on TASK-037 (`v1` and `v1.0.0` on `b3f11cf`). Changelog entry is in `CHANGELOG.md`.
- [x] The onboarding guide exists and names every input, secret and variable.

**References:** TASK-030, TASK-031, TASK-032; TASK-037.

### TASK-032: Platform: Terraform modules (render-service, cloudflare-worker, supabase-project)
**Status:** COMPLETED  
**Priority:** Normal  
**Duration:** 1–2 days  
**Category:** Topology  
**Depends On:** None  
**Source:** VovoSpaces infra TASK-032  
**Environments:** none until a caller uses it  
**Applied:** no  
**Questions:** none  
**Review:** self-review (high)  
**Completed:** 2026-10-03  

**Description:** Turn VovoSpaces `infra/terraform/main.tf`, `workers.tf` and `supabase.tf` into modules under `terraform/modules/`. Ansible roles are not part of this card.

**Technical Constraints:**
- Carry the lessons as module defaults, each with its *why* comment: `prevent_destroy` on every resource; Render `ignore_changes` on `env_vars`, `pull_request_previews_enabled`, the image tag, digest and image URL; Workers' `subdomain` block pinned (omitting it turned `*.workers.dev` off); `cloudflare_worker`, not `cloudflare_workers_script`.
- No provider credentials inside modules; providers are configured by the caller.
- Callers pin with `?ref=v1`. The repo is public, so a remote Terraform run can fetch it without credentials.

**Acceptance Criteria:**
- [x] Three modules, each with a README listing inputs and outputs.
- [x] `terraform validate` passes on a test caller.

**References:** `~/workspace/vovo-spaces/infra/terraform/*.tf`. Structure gate: topology in `infra/INFRA.md` approved 2026-10-03.

---

### TASK-031: Platform: reusable frontend workflow (Next + OpenNext → Cloudflare Workers)
**Status:** COMPLETED  
**Priority:** Normal  
**Duration:** 1 day  
**Category:** Pipeline  
**Depends On:** None  
**Source:** VovoSpaces infra TASK-031  
**Environments:** none until a caller uses it  
**Applied:** no  
**Questions:** none  
**Review:** self-review (medium)  
**Completed:** 2026-10-03  

**Description:** Extract the `frontend` test job and the `frontend-deploy` matrix from VovoSpaces' `ci.yml` into `.github/workflows/next-cloudflare.yml` with `on: workflow_call`.

**Technical Constraints:**
- Inputs: `working_directory` (`frontend`), `node_version` (`24`; wrangler needs ≥22), `apps` (the matrix list, e.g. `["client","admin"]`), workspace package scope (`@vovospaces`), `deploy` switch. Build-time `NEXT_PUBLIC_*` values come from the caller (variables/secrets), never defaults in this repo.
- The test build keeps presence-only Supabase placeholders (the `/sign-in` prerender).
- Keep the ordering rule: frontend deploy waits for the backend deploy when both run in one caller.

**Acceptance Criteria:**
- [x] The workflow is in this repo.
- [x] A test caller lints, tests and builds; with the switch off, deploys nothing. — proof on TASK-036: https://github.com/theagester12345/agada-tech-platform/actions/runs/37312430650
- [x] Inputs documented in the platform README.

**References:** `~/workspace/vovo-spaces/.github/workflows/ci.yml` (`frontend`, `frontend-deploy`); TASK-036.

---

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
- [x] A test caller builds, pushes and (with the switch off) skips the deploy. — proof on TASK-035: https://github.com/theagester12345/agada-tech-platform/actions/runs/37217543137
- [x] Its inputs are documented in the platform README.

**References:** `~/workspace/vovo-spaces/.github/workflows/ci.yml`; `~/workspace/vovo-spaces/infra/scripts/render-deploy.sh`; TASK-035.

---

---

_Last Updated: 2026-10-05_
