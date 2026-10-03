variable "project_ref" {
  type        = string
  description = "Existing Supabase project ref. This module does not create the project."
}

variable "site_url" {
  type        = string
  description = "Auth site_url (usually the public client origin)."
}

variable "uri_allow_list" {
  type        = list(string)
  description = "Auth redirect allowlist. Order is an auth API write; pass it in the order already live if you are importing."
}
