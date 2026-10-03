# Agada Tech Platform — Infrastructure


Infrastructure config (CI/CD, IaC, containers, environment/secrets wiring, deploy).

**The overall deployment architecture lives in [`INFRA.md`](./INFRA.md)** — topology, hosting/CDN/DNS choices (e.g. Cloudflare), environments, secrets, CI/CD. Per-side READMEs keep *local* run/build and point here for the system-level picture.

## Ownership — this side has its own agent

**`infra/` has an architect persona ([`ARCHITECT.md`](./ARCHITECT.md)), its own [`TASK.md`](./TASK.md), [`SESSION_LOG.md`](./SESSION_LOG.md) and [`INTERFACE.md`](./INTERFACE.md) outbox**, and it is a participant in the cross-side channel with the code **`IN`**. It owns this doc home and the code paths it declares in [`../STACK.md`](../STACK.md) → Code paths.

- **Engineering `read`s `infra/` and asks for changes** through a `REQUEST` addressed `To: IN` in its own outbox. It does not edit here.
- **Infra reads engineering's code** — what a service listens on, what it builds to, what it expects in its environment — and never edits it; a deployment decision that forces a change on a side travels the same channel in the other direction.
- **Applying to a live environment is user-gated** ([canonical](../WORKFLOW.md#operating-modes-spec--build)): this side writes the change and produces the plan; a person runs it.

**This reverses the earlier design**, where `infra/` deliberately had no agent and was owned ad-hoc by whichever engineering side's SPEC chat needed it. That model kept infra decisions next to the code they serve, which was its stated reason — but a genuinely cross-cutting decision had **no owner and no readable home**: it was logged in one side's `SESSION_LOG.md`, and the permission table **denies** each side the other's doc home, so the record landed where half the people who needed it could not read it.

**Where a project scaffolds no `infra/` workspace, the old model still applies** — the engineering side owns its own deployment concerns and logs them in its own `SESSION_LOG.md`. This side exists when infra is enough work to be somebody's job.

## What lives here
_<CI/CD pipelines, IaC (Terraform/Pulumi/etc.), docker/compose, env templates, deploy scripts. Record the concrete choices on bootstrap.>_
