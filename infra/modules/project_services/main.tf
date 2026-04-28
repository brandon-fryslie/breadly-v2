// Enables the GCP APIs Breadly needs. Each api gets disable_on_destroy=false
// so tearing down a Terraform stack doesn't pull the rug out from anything
// else in the project.

variable "project_id" {
  type = string
}

locals {
  apis = [
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "compute.googleapis.com",
    "servicenetworking.googleapis.com",
  ]
}

resource "google_project_service" "this" {
  for_each = toset(local.apis)

  project                    = var.project_id
  service                    = each.value
  disable_on_destroy         = false
  disable_dependent_services = false
}

output "enabled" {
  value = [for s in google_project_service.this : s.service]
}
