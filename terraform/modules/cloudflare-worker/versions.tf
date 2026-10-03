terraform {
  required_version = ">= 1.5.0"

  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
      # 5.x is the line that has cloudflare_worker, which holds a Worker's
      # settings without its code. Do not use cloudflare_workers_script.
      version = "~> 5.26"
    }
  }
}
