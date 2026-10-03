# Agada Tech Platform — Deployment & Infrastructure Architecture


The **overall** deployment picture — the system-level view no single side's README owns. Per-side local run/build stays in each side's README; this is how it all fits together in the real world.

## Topology

This repo is a library. It has no client, API, or database of its own. Callers run the recipes.

```
caller repo
  → calls .github/workflows/java-maven-render.yml@<pin>
      → mvn verify
      → GHCR image (linux/amd64, by digest)
      → Render (only when the caller passes deploy: true)
```

> **This is *where it runs* — a different graph from *how the software is structured*.** Module topology, dependencies and seams live in [`../SYSTEM_MAP.md`](../SYSTEM_MAP.md). Keep the two apart and cross-reference: a monolith is one deployment box and many modules, so merging them loses the second graph entirely.

## Hosting & platforms
| Concern | Choice | Notes |
|---|---|---|
| This repo | none | Public library when the GitHub repo exists. No service runs here. |
| Caller backend | Render, image from GHCR | The recipe deploys a digest. Account and service id stay in the caller. |
| Caller frontend | not this card | TASK-031. |
| Auth | none here | |

## Environments

None in this repo. A caller that uses the recipe today has one test server, built and deployed from `main`. A second environment is not an input on the recipe.

## Secrets & config

Names only. Values stay in each caller.

| Name | Class | Who sets it | Read by |
|---|---|---|---|
| `RENDER_API_KEY` | secret | caller Actions secret | `java-maven-render` deploy job; `infra/scripts/render-deploy.sh` |
| `RENDER_SERVICE_ID` | identifier | caller Actions variable | same |
| `GITHUB_TOKEN` | secret, per job | GitHub | image push and release retag |
| `DEPLOY_BACKEND` | config | caller variable, mapped to the `deploy` input | caller, not this repo |

## CI/CD

- **Recipe:** `.github/workflows/java-maven-render.yml` (`workflow_call`). Jobs `backend` (`mvn verify`), `backend-image` (push to GHCR on a push to `main`), `backend-deploy` (Render, only when `deploy` is true). Deploy script: `infra/scripts/render-deploy.sh`, checked out from this repo so the caller does not copy it.
- **Release recipe:** `.github/workflows/java-maven-release.yml`. release-please in the caller, then retag `:sha-<commit>` to `:<version>`. No second image build.
- **Throwaway caller:** `.github/workflows/test-java-maven-render.yml` against `infra/fixtures/java-maven-render`, `deploy: false`.
- **Apply:** this repo does not deploy a service. Callers do. User-run here is creating the public GitHub repo, pushing `main`, and later tagging `v1`.

## Ownership
**This side's agent owns this file** ([`ARCHITECT.md`](./ARCHITECT.md)) and updates it **in the same change** as the deployment-architecture decision it records (e.g. "frontend → Cloudflare Pages", "add a staging env"). Every other side **reads** it — this is where they learn where things run.

The running system is the source of truth here, not the reverse: read what is deployed before describing it, and where they disagree, this document is the thing that is wrong.

If a project has **no `infra/` directory**, don't create one just for this — the engineering side keeps deployment notes in its own README and `SESSION_LOG.md`, as before.

---

_Last Updated: 2026-10-03_
