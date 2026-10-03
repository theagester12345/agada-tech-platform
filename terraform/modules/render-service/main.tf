# Render pulls the image CI built; it does not build from git. An image-backed
# service has no auto-deploy, so the caller's pipeline is what ships.
resource "render_web_service" "this" {
  name              = var.name
  plan              = var.plan
  region            = var.region
  root_directory    = var.root_directory
  health_check_path = var.health_check_path

  runtime_source = {
    image = {
      image_url              = var.image_url
      tag                    = var.tag
      registry_credential_id = var.registry_credential_id
    }
  }

  previews = {
    generation = "off"
  }

  notification_override = {
    notifications_to_send         = "default"
    preview_notifications_enabled = "default"
  }

  lifecycle {
    # A replace gives a new onrender.com host and drops env values that live
    # only on the dashboard.
    prevent_destroy = true

    # env_vars: values stay on the dashboard. Plan proposing to clear them
    # would remove credentials.
    # pull_request_previews_enabled cannot be set beside previews.generation,
    # and omitting it makes plan propose a change.
    # tag, digest, image_url: CI deploys by digest through the Render API.
    # Provider 1.9.1 then reads image_url back as "<repo>@sha256", which is a
    # misread, not drift. Without ignore, every plan after a deploy proposes
    # a change that would fail. Cost: a change of image repository is
    # invisible to plan; make one through the Render API, then match config.
    ignore_changes = [
      env_vars,
      pull_request_previews_enabled,
      runtime_source.image.image_url,
      runtime_source.image.tag,
      runtime_source.image.digest,
    ]
  }
}
