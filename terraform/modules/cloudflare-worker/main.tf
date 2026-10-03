# cloudflare_worker holds the Worker and its settings, not its code. The
# OpenNext bundle is uploaded by wrangler from the caller's pipeline. Keeping
# the bundle out of Terraform stops each build from showing as drift, and
# stops Terraform and wrangler both writing the code.
#
# subdomain is pinned: omitting it turned *.workers.dev off (plan proposed
# enabled and previews_enabled true -> false). Wrangler can write the same
# flags (workers_dev, preview_urls). Keep the two in step.
resource "cloudflare_worker" "this" {
  account_id = var.account_id
  name       = var.name
  subdomain = {
    enabled          = true
    previews_enabled = true
  }

  lifecycle {
    # Terraform does not hold the code, so a destroy or replace cannot be
    # undone from state. Lift prevent_destroy only to destroy a Worker on purpose.
    prevent_destroy = true
  }
}
