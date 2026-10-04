# STACK — resolved project stack

This repo is a library. It runs no application. Callers (VovoSpaces, and later other projects) read its workflows and modules. Secrets, account ids and service ids stay in the caller.

| Attribute | Value |
|---|---|
| Project name | `Agada Tech Platform` |
| Shape | library — no independently buildable application side |
| Local path | `~/workspace/agada-tech-platform` |
| GitHub | not chosen yet. The repo is public when it is created (VovoSpaces DEPLOYMENT_PLAN D8) |
| **Shared** | |
| Task tracker | Plane, when this repo is given its own key prefix. Do not reuse VovoSpaces' `IN-` prefix |
| Persona — infra | `Platform` |
| **Legal / Back Office** | |
| Company / legal entity | none in this repo |
| Governing-law jurisdiction | none in this repo |

## Code paths (per side)

| Side | Doc home | Code paths (writable) |
|---|---|---|
| Infra (`IN`) | `infra/` | `.github/workflows/`, `terraform/modules/`, `ansible/roles/`, `infra/scripts/` |

There is no `backend/`, `frontend/`, `product/` or `back-office/` workspace.

## Commands

| Action | Value |
|---|---|
| Run dev | none — this repo does not run |
| Build | none |
| Test | Backend fixture: `mvn -B -ntp verify` in `infra/fixtures/java-maven-render`. Frontend fixture: `npm ci && npm run lint && npm test && npm run build` in `infra/fixtures/next-cloudflare`. Terraform: `terraform init -backend=false && terraform validate` in `infra/fixtures/terraform-modules`. GitHub: `test-java-maven-render.yml`, `test-next-cloudflare.yml` |
| Lint / typecheck | none |
| Review (the gate) | Claude Code: the agent-invocable `self-review` skill (`<tier>` = `high`/`medium`); better but user-invocation-only: `/code-review <tier>` |
| Schema diagram | no data model |
| Review questions | `AI-Question` — the token a reviewer types |
| …collect them | `adapters/questions/scan-questions.sh <declared paths>` |
| **User-run** — changes a live environment | Create the public GitHub repository. `git push` of `main` once a remote exists. Branch protection on `main`. Tag and push the platform pin: `git tag -a v1.0.0 -m "v1.0.0"` then `git tag -f v1 v1.0.0` then `git push origin v1.0.0 v1`. Nothing here applies Terraform or deploys a service; callers do that. The fixture under `infra/fixtures/terraform-modules` is validate-only. |

> **User-run** lists every command that changes a live environment. This repo holds recipes. Applying them happens in the caller, and that caller's own list covers the apply.
