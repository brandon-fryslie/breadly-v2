variable "project_id" {
  type        = string
  description = "GCP project ID for the prod environment"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "image" {
  type        = string
  description = "Container image to deploy"
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "clerk_publishable_key" {
  type        = string
  description = "Clerk publishable key (pk_live_...)"
  default     = ""
}

variable "db_password" {
  type      = string
  sensitive = true
}
