# supabase_project is not used: it requires database_password in config,
# which would put the password in remote state. supabase_settings can manage
# the auth redirect allowlist without that.
#
# prevent_destroy here only blocks deleting this resource from state.
# Destroying the project itself is still a dashboard action and is irreversible.
resource "supabase_settings" "this" {
  project_ref = var.project_ref

  # Only these two keys are managed. Other auth fields stay on the dashboard.
  # Shrinking auth to these keys is a partial PATCH: omitted keys are not
  # deleted on Supabase.
  auth = jsonencode({
    site_url       = var.site_url
    uri_allow_list = join(",", var.uri_allow_list)
  })

  lifecycle {
    prevent_destroy = true
  }
}
