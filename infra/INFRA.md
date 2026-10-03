# Agada Tech Platform — Deployment & Infrastructure Architecture


The **overall** deployment picture — the system-level view no single side's README owns. Per-side local run/build stays in each side's README; this is how it all fits together in the real world.

## Topology
_<How the pieces connect in prod: client → CDN/edge → frontend host → backend API → DB / storage / auth. A quick diagram or bullet flow.>_

> **This is *where it runs* — a different graph from *how the software is structured*.** Module topology, dependencies and seams live in [`../SYSTEM_MAP.md`](../SYSTEM_MAP.md). Keep the two apart and cross-reference: a monolith is one deployment box and many modules, so merging them loses the second graph entirely.

## Hosting & platforms
| Concern | Choice | Notes |
|---|---|---|
| Frontend hosting | _<e.g. Cloudflare Pages>_ | |
| Backend hosting | _<e.g. Fly.io / container host / VM>_ | |
| Database / storage | _<managed service>_ | |
| DNS / CDN / edge | _<e.g. Cloudflare>_ | |
| Auth | _<provider>_ | |

## Environments
_<local / dev / staging / prod — what each points at, how they differ, URLs.>_

## Secrets & config
_<Where secrets live (never in git), how they reach each environment.>_

## CI/CD
_<Pipelines: what builds / tests / deploys each side, triggers, gates, rollbacks.>_

## Ownership
**This side's agent owns this file** ([`ARCHITECT.md`](./ARCHITECT.md)) and updates it **in the same change** as the deployment-architecture decision it records (e.g. "frontend → Cloudflare Pages", "add a staging env"). Every other side **reads** it — this is where they learn where things run.

The running system is the source of truth here, not the reverse: read what is deployed before describing it, and where they disagree, this document is the thing that is wrong.

If a project has **no `infra/` directory**, don't create one just for this — the engineering side keeps deployment notes in its own README and `SESSION_LOG.md`, as before.

---

_Last Updated: YYYY-MM-DD_
