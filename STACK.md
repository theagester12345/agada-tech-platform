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
| Test | a caller exercises a workflow; this repo has no test command of its own yet |
| Lint / typecheck | none |
| Review (the gate) | Claude Code: the agent-invocable `self-review` skill (`<tier>` = `high`/`medium`); better but user-invocation-only: `/code-review <tier>` |
| Schema diagram | no data model |
| Review questions | `AI-Question` — the token a reviewer types |
| …collect them | `adapters/questions/scan-questions.sh <declared paths>` |
| **User-run** — changes a live environment | `git push` of `main` once a remote exists. Creating the public GitHub repository. Branch protection on `main`. Tagging `v1` (a later card). Nothing here applies Terraform or deploys a service; callers do that |

> **User-run** lists every command that changes a live environment. This repo holds recipes. Applying them happens in the caller, and that caller's own list covers the apply.
