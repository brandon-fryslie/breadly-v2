variable "project_id" {
  type        = string
  description = "GCP project ID for the dev environment"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "image" {
  type        = string
  description = "Container image to deploy. After E1.7 wires CI, this updates per build."
  default     = "us-docker.pkg.dev/cloudrun/container/hello" // bootstrap with the GCP hello image
}

variable "clerk_publishable_key" {
  type        = string
  description = "Clerk publishable key (pk_test_...). Public; safe to set here."
  default     = ""
}

variable "db_password" {
  type        = string
  description = "Initial Cloud SQL app-user password. Stored in tfvars or passed via -var; rotate via Secret Manager afterwards."
  sensitive   = true
}
