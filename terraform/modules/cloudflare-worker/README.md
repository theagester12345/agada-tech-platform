# cloudflare-worker

One Cloudflare Worker’s settings, not its code. Call once per app. Providers are configured by the caller. Pin with `?ref=v1`.

Uses `cloudflare_worker` (provider 5.x), not `cloudflare_workers_script`.

## Inputs

| Name | Type | Default | Required | Description |
|---|---|---|---|---|
| `account_id` | string | | yes | Cloudflare account id |
| `name` | string | | yes | Worker name |

## Outputs

| Name | Description |
|---|---|
| `id` | Worker id |
| `name` | Worker name |

`prevent_destroy` is on. The `subdomain` block is pinned (`enabled` and `previews_enabled` true). Omitting it turned `*.workers.dev` off.
