variable "account_id" {
  type        = string
  description = "Cloudflare account that hosts this Worker. Changing it replaces the Worker, which prevent_destroy refuses."
}

variable "name" {
  type        = string
  description = "Worker name."
}
