# supabase-project

Auth settings for an **existing** Supabase project. It does not create the project (`supabase_project` would need `database_password` in config). Providers are configured by the caller. Pin with `?ref=v1`.

## Inputs

| Name | Type | Default | Required | Description |
|---|---|---|---|---|
| `project_ref` | string | | yes | Existing project ref |
| `site_url` | string | | yes | Auth site URL |
| `uri_allow_list` | list(string) | | yes | Redirect allowlist |

## Outputs

| Name | Description |
|---|---|
| `project_ref` | The project ref |

`prevent_destroy` is on. That only protects the Terraform resource. Deleting the project in the dashboard is still irreversible.
