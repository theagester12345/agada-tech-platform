variable "name" {
  type        = string
  description = "Render web service name."
}

variable "plan" {
  type        = string
  description = "Render plan. Default is the free test tier."
  default     = "free"
}

variable "region" {
  type        = string
  description = "Render region."
  default     = "oregon"
}

variable "root_directory" {
  type        = string
  description = "Repo directory Render would use if it built from git. Kept for import compatibility."
  default     = "backend"
}

variable "health_check_path" {
  type        = string
  description = "Path Render must see healthy before a deploy is live."
  default     = "/api/v1/health"
}

variable "image_url" {
  type        = string
  description = "GHCR image without a tag, e.g. ghcr.io/<owner>/<name>. After the first apply, CI deploys by digest and ignore_changes keeps plan from undoing that."
}

variable "tag" {
  type        = string
  description = "Image tag used only on the first apply. After that CI owns the live digest."
  default     = "main"
}

variable "registry_credential_id" {
  type        = string
  description = "Render registry credential id that can pull the private image. Created in the dashboard, not here, so the token never enters state."
}
