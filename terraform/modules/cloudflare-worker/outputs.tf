output "id" {
  description = "Worker id."
  value       = cloudflare_worker.this.id
}

output "name" {
  description = "Worker name."
  value       = cloudflare_worker.this.name
}
