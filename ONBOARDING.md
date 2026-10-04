# Onboard a project

This library is `theagester12345/agada-tech-platform`. Replace every other `<…>` with values from the caller. Do not copy a secret or account id into this repository.

Onboarding is two files in the **caller**, about 35 lines, then the names below. The original “two secrets” line was the pipeline pair (`RENDER_API_KEY`, `CLOUDFLARE_DEPLOY_TOKEN`). A full stack also needs the Terraform tokens and the public Next values. Set them in this order. Names only.

## 1. GitHub Actions — set these first

Secrets, then variables. Deploy stays off until both `DEPLOY_*` variables are `true`.

| Order | Kind | Name | Used by |
|---|---|---|---|
| 1 | secret | `RENDER_API_KEY` | `java-maven-render` (deploy) |
| 2 | secret | `CLOUDFLARE_DEPLOY_TOKEN` | `next-cloudflare` (deploy) |
| 3 | secret | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `next-cloudflare` (deploy build) |
| 4 | variable | `RENDER_SERVICE_ID` | `java-maven-render` |
| 5 | variable | `CLOUDFLARE_ACCOUNT_ID` | `next-cloudflare` |
| 6 | variable | `NEXT_PUBLIC_API_URL` | `next-cloudflare` |
| 7 | variable | `NEXT_PUBLIC_SUPABASE_URL` | `next-cloudflare` |
| 8 | variable | `DEPLOY_BACKEND` | caller, mapped to `deploy` |
| 9 | variable | `DEPLOY_FRONTEND` | caller, mapped to `deploy` |

`GITHUB_TOKEN` is created per job. Do not set it.

## 2. Terraform — set these in the caller’s apply environment

| Order | Kind | Name | Used by |
|---|---|---|---|
| 10 | secret | `RENDER_API_KEY` | Render provider (same name as the pipeline) |
| 11 | identifier | `RENDER_OWNER_ID` | Render provider |
| 12 | secret | `CLOUDFLARE_API_TOKEN` | Cloudflare provider. Not the wrangler token. |
| 13 | secret | `SUPABASE_ACCESS_TOKEN` | Supabase provider |

Apply is the caller’s command, not this repo’s.

## 3. Two files in the caller

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  backend:
    uses: theagester12345/agada-tech-platform/.github/workflows/java-maven-render.yml@v1
    permissions: { contents: read, packages: write }
    with:
      working_directory: backend
      java_version: "21"
      image_name: ghcr.io/<owner>/<name>
      deploy: ${{ vars.DEPLOY_BACKEND == 'true' }}
    secrets: inherit
  frontend:
    needs: backend
    uses: theagester12345/agada-tech-platform/.github/workflows/next-cloudflare.yml@v1
    with:
      working_directory: frontend
      node_version: "24"
      apps: '["client"]'
      workspace_scope: "@<scope>"
      deploy: ${{ vars.DEPLOY_FRONTEND == 'true' }}
    secrets: inherit
```

`infra/terraform/main.tf` (providers stay in the caller):

```hcl
module "api" {
  source                 = "git::https://github.com/theagester12345/agada-tech-platform.git//terraform/modules/render-service?ref=v1"
  name                   = "<service>"
  image_url              = "ghcr.io/<owner>/<name>"
  registry_credential_id = var.render_registry_credential_id
}
module "client" {
  source     = "git::https://github.com/theagester12345/agada-tech-platform.git//terraform/modules/cloudflare-worker?ref=v1"
  account_id = var.cloudflare_account_id
  name       = "<worker>"
}
module "auth" {
  source         = "git::https://github.com/theagester12345/agada-tech-platform.git//terraform/modules/supabase-project?ref=v1"
  project_ref    = var.supabase_project_ref
  site_url       = var.site_url
  uri_allow_list = var.uri_allow_list
}
```

Optional third file: call `java-maven-release.yml@v1` with `image_name` only. `release-please-config.json` stays in the caller.

## Inputs

| Recipe or module | Inputs |
|---|---|
| `java-maven-render` | `working_directory`, `java_version`, `image_name`, `deploy` |
| `java-maven-release` | `image_name` |
| `next-cloudflare` | `working_directory`, `node_version`, `apps`, `workspace_scope`, `deploy` |
| `render-service` | `name`, `image_url`, `registry_credential_id`; optional `plan`, `region`, `root_directory`, `health_check_path`, `tag` |
| `cloudflare-worker` | `account_id`, `name` |
| `supabase-project` | `project_ref`, `site_url`, `uri_allow_list` |

Defaults and meanings: [`README.md`](README.md). Pin: `@v1` / `?ref=v1`. Rule: [`CHANGELOG.md`](CHANGELOG.md).
