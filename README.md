# Agada Tech Platform

A public library of deploy recipes. It runs nothing of its own. A project calls a workflow or a Terraform module and pins a version (`@v1`). Credentials, account ids and service ids stay in the caller. None of them belong in this repo.

Local path: `~/workspace/agada-tech-platform`. The GitHub owner is not chosen yet.

```
.github/workflows/     reusable workflows
terraform/modules/     render-service, cloudflare-worker, supabase-project
ansible/roles/         empty until the Oracle box work exists
infra/                 this repo's agent, board, deploy script, and fixtures
```

## `java-maven-render`

Reusable workflow: `.github/workflows/java-maven-render.yml`.

Caller job (the owner and pin change once this repo is public and tagged):

```yaml
jobs:
  backend:
    uses: <owner>/<repo>/.github/workflows/java-maven-render.yml@v1
    permissions:
      contents: read
      packages: write
    with:
      working_directory: backend
      java_version: "21"
      image_name: ghcr.io/<owner>/<name>
      deploy: ${{ vars.DEPLOY_BACKEND == 'true' }}
    secrets: inherit
```

| Kind | Name | Default | What it is |
|---|---|---|---|
| input | `working_directory` | `backend` | Directory with `pom.xml` and the Dockerfile |
| input | `java_version` | `21` | Temurin major version; must match the pom |
| input | `image_name` | (required) | GHCR image, no tag: `ghcr.io/<owner>/<name>` |
| input | `deploy` | `false` | Deploy the new digest to Render. Off still builds and pushes the image on a push to `main` |
| secret | `RENDER_API_KEY` | — | Passed explicitly or with `secrets: inherit`. Needed only when `deploy` is true |
| variable | `RENDER_SERVICE_ID` | — | Caller repo variable. The recipe reads `vars.RENDER_SERVICE_ID` |
| output | `image` | — | `image_name@sha256:<digest>` after a successful image job; empty otherwise |

The deploy script is `infra/scripts/render-deploy.sh`. The recipe checks it out from this repo, so the caller does not copy it.

Kept from the VovoSpaces pipeline: `linux/amd64`, deploy by digest, `packages: write` only on the image job, no cancel of a run on `main`. Package visibility follows the caller repo.

A second environment and a promotion input are not in this recipe.

### Throwaway caller

`.github/workflows/test-java-maven-render.yml` calls the recipe against `infra/fixtures/java-maven-render` with `deploy: false`.

## `java-maven-release`

Reusable workflow: `.github/workflows/java-maven-release.yml`.

Runs release-please, then labels the image already built for that commit (`:sha-<commit>` → `:<version>`). It does not rebuild. `release-please-config.json` and `.release-please-manifest.json` stay in the caller.

```yaml
on:
  push:
    branches: [main]
jobs:
  release:
    uses: <owner>/<repo>/.github/workflows/java-maven-release.yml@v1
    permissions:
      contents: write
      pull-requests: write
      packages: write
    with:
      image_name: ghcr.io/<owner>/<name>
```

| Kind | Name | Default | What it is |
|---|---|---|---|
| input | `image_name` | (required) | Same image `java-maven-render` pushed, no tag |

## `next-cloudflare`

Reusable workflow: `.github/workflows/next-cloudflare.yml`.

When a caller runs both recipes, the frontend job waits on the backend job so an API-contract change does not reach users first:

```yaml
jobs:
  backend:
    uses: <owner>/<repo>/.github/workflows/java-maven-render.yml@v1
    # ...
  frontend:
    needs: backend
    uses: <owner>/<repo>/.github/workflows/next-cloudflare.yml@v1
    with:
      working_directory: frontend
      node_version: "24"
      apps: '["client","admin"]'
      workspace_scope: "@vovospaces"
      deploy: ${{ vars.DEPLOY_FRONTEND == 'true' }}
    secrets: inherit
```

| Kind | Name | Default | What it is |
|---|---|---|---|
| input | `working_directory` | `frontend` | Directory with `package.json` and `package-lock.json` |
| input | `node_version` | `24` | Node major; wrangler needs at least 22 |
| input | `apps` | (required) | JSON array of app names for the deploy matrix |
| input | `workspace_scope` | (required) | npm scope, e.g. `@vovospaces`. Deploy runs `--workspace=<scope>/<app>` |
| input | `deploy` | `false` | Deploy each Worker. Off still lints, tests and builds |
| secret | `CLOUDFLARE_DEPLOY_TOKEN` | — | wrangler. Needed only when `deploy` is true |
| secret | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | Inlined at deploy build time. Needed only when `deploy` is true |
| variable | `NEXT_PUBLIC_API_URL` | — | Caller variable. No default in this repo |
| variable | `NEXT_PUBLIC_SUPABASE_URL` | — | Caller variable. No default in this repo |
| variable | `CLOUDFLARE_ACCOUNT_ID` | — | Caller variable |

The test job's Supabase values are presence-only placeholders for prerender. A real deploy uses the caller.

### Throwaway caller

`.github/workflows/test-next-cloudflare.yml` calls the recipe against `infra/fixtures/next-cloudflare` with `deploy: false`.

## Terraform modules

Each module has its own README for inputs and outputs. Providers are configured by the caller. No credentials live in a module. Pin with `?ref=v1` once the public repo and tag exist.

```hcl
module "api" {
  source                 = "git::https://github.com/<owner>/<repo>.git//terraform/modules/render-service?ref=v1"
  name                   = "<service>"
  image_url              = "ghcr.io/<owner>/<name>"
  registry_credential_id = var.render_registry_credential_id
}

module "client" {
  source     = "git::https://github.com/<owner>/<repo>.git//terraform/modules/cloudflare-worker?ref=v1"
  account_id = var.cloudflare_account_id
  name       = "<worker>"
}

module "auth" {
  source         = "git::https://github.com/<owner>/<repo>.git//terraform/modules/supabase-project?ref=v1"
  project_ref    = var.supabase_project_ref
  site_url       = var.site_url
  uri_allow_list = var.uri_allow_list
}
```

| Module | Resource | What it does not do |
|---|---|---|
| `render-service` | `render_web_service` | Does not put env values in config. CI deploys the image by digest. |
| `cloudflare-worker` | `cloudflare_worker` | Does not hold Worker code. wrangler uploads the bundle. |
| `supabase-project` | `supabase_settings` | Does not create the project. `supabase_project` would need the database password in state. |

`prevent_destroy` is on every resource. Render also ignores `env_vars`, `pull_request_previews_enabled`, and the image tag, digest, and URL.

### Throwaway caller

`infra/fixtures/terraform-modules` instantiates all three with fake ids. `terraform validate` is the test. Do not apply it.
