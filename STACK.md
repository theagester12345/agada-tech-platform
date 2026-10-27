# STACK — resolved project stack

This repo is a library. It runs no application. Callers (VovoSpaces, and later other projects) read its workflows and modules. Secrets, account ids and service ids stay in the caller.

| Attribute | Value |
|---|---|
| Project name | `Agada Tech Platform` |
| Shape | library — no independently buildable application side. Closest template shape: `infrastructure only` |
| Local path | `~/workspace/agada-tech-platform` |
| GitHub | public: `theagester12345/agada-tech-platform` (VovoSpaces DEPLOYMENT_PLAN D8). Move into an Agada org later if the company exists. |
| **Shared** | |
| Task tracker | Plane, when this repo is given its own key prefix. Do not reuse VovoSpaces' `IN-` prefix. Credentials then go in a repo-root `.env` (names in `.env.example`); prefix and side label are flags in infra's sync command |
| Persona — infra | `Platform` |
| **Legal entity** | |
| Company / legal entity | none in this repo |
| Governing-law jurisdiction | none in this repo |

## Code paths (per side)

| Side | Doc home | Code paths (writable) |
|---|---|---|
| Infra (`IN`) | `infra/` | `.github/workflows/`, `terraform/modules/`, `ansible/roles/`, `infra/scripts/` |

There is no `backend/`, `frontend/`, `product/` or `legal/` workspace.

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
| **Read-only ops** — reads a live environment | The public GitHub REST API, no auth: `curl -s https://api.github.com/repos/theagester12345/agada-tech-platform/<path>` (`actions/runs`, `actions/runs/<id>/jobs`, `check-runs/<id>/annotations`, `branches/main`) and `git ls-remote origin`. `gh` is not installed. Nothing else is live: this repo deploys nothing |
| **Workflow review** — client-repo mode | `n/a — this repo is ours` |
| **Diff opener** — *open diffs* | `bash adapters/diff-open/diff-open.sh --opener vscode --editor-bin code` |
| **Archive window** — closed work kept in view | `--keep 10` for [`adapters/consolidate/`](./CONSOLIDATION.md#the-board-moves-by-script): closed cards and outbox entries past the 10 newest move to `*_ARCHIVE.md` |
| **Start-up cost** — tokens each persona loads at init | `bash adapters/measure/measure-context.sh` — the files that dominate are what to consolidate ([README](./adapters/measure/README.md)) |
| **Task cost** — tokens each task used, from this host's logs (approximate) | `node adapters/measure/task-cost-claude-code.js --project .` on Claude Code |

> **User-run** lists every command that changes a live environment. This repo holds recipes. Applying them happens in the caller, and that caller's own list covers the apply.

> **Read-only ops** is how the agent **reads** a live environment, in any mode. Everything that writes stays **User-run**. The credentials are the user's to set up, never the agent's.

> **Diff opener** opens a task's own diffs **one file at a time**, each waiting until it is closed. **Because it waits, run it in the background** and react when it exits with *collect or approve?*. Details: [`adapters/diff-open/README.md`](./adapters/diff-open/README.md).
