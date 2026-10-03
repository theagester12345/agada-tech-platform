# Agada Tech Platform

A public library of deploy recipes. It runs nothing of its own. A project calls a workflow or a Terraform module and pins a version (`@v1`). Credentials, account ids and service ids stay in the caller. None of them belong in this repo.

Local path: `~/workspace/agada-tech-platform`. The GitHub owner is not chosen yet.

```
.github/workflows/     reusable workflows
terraform/modules/     render-service, cloudflare-worker, supabase-project (empty)
ansible/roles/         empty until the Oracle box work exists
infra/                 this repo's agent, board, and deploy script
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
