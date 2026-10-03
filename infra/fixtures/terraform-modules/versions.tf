# Throwaway caller for terraform validate. Providers have no credentials
# here; validate does not talk to any account.
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    render = {
      source  = "render-oss/render"
      version = "~> 1.9"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.26"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.11"
    }
  }
}

provider "render" {}
provider "cloudflare" {}
provider "supabase" {}
