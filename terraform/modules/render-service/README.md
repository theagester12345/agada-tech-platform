# render-service

One Render web service that pulls a prebuilt GHCR image. Providers are configured by the caller. Pin with `?ref=v1`.

## Inputs

| Name | Type | Default | Required | Description |
|---|---|---|---|---|
| `name` | string | | yes | Service name |
| `image_url` | string | | yes | GHCR image, no tag |
| `registry_credential_id` | string | | yes | Render credential that can pull the private image |
| `plan` | string | `free` | no | Render plan |
| `region` | string | `oregon` | no | Render region |
| `root_directory` | string | `backend` | no | Kept for import compatibility |
| `health_check_path` | string | `/api/v1/health` | no | Path that must be healthy before a deploy is live |
| `tag` | string | `main` | no | First-apply tag only; CI then deploys by digest |

## Outputs

| Name | Description |
|---|---|
| `id` | Render service id |
| `name` | Service name |

`prevent_destroy` is on. `ignore_changes` covers `env_vars`, `pull_request_previews_enabled`, and the image tag, digest, and URL. Env values stay on the dashboard, not in this module.
