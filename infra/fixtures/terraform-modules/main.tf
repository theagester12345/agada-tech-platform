module "api" {
  source                 = "../../../terraform/modules/render-service"
  name                   = "fixture-api"
  image_url              = "ghcr.io/example/fixture-backend"
  registry_credential_id = "rgc-fixture"
}

module "client" {
  source     = "../../../terraform/modules/cloudflare-worker"
  account_id = "00000000000000000000000000000000"
  name       = "fixture-client"
}

module "auth" {
  source      = "../../../terraform/modules/supabase-project"
  project_ref = "abcdefghijklmnop"
  site_url    = "https://example.workers.dev"
  uri_allow_list = [
    "http://localhost:3000/**",
  ]
}
