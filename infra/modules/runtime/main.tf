// Cloud Run service for the Next.js app, plus its service account and the
// IAM bindings the SA needs (Cloud SQL connect, GCS object access on photo
// + upload buckets). Secret env wiring uses Secret Manager references —
// values are resolved at container start.

variable "project_id" { type = string }
variable "region" { type = string }
variable "env" { type = string }

variable "image" {
  type        = string
  description = "Container image to deploy (e.g. us-central1-docker.pkg.dev/PROJECT/REPO/breadly-web:tag)"
}

variable "cloudsql_connection_name" {
  type        = string
  description = "Output from the database module (project:region:instance)"
}

variable "photos_bucket" { type = string }
variable "uploads_bucket" { type = string }

variable "secret_ids" {
  type        = map(string)
  description = "Map of logical-name -> Secret Manager secret_id, from the secrets module"
}

variable "clerk_publishable_key" {
  type        = string
  description = "Public; safe to ship in image. Set as plain env var."
  default     = ""
}

variable "min_instances" {
  type    = number
  default = 0
}
variable "max_instances" {
  type    = number
  default = 4
}

// SA is created in the env (top-level) so the secrets module can also
// bind IAM to it without creating a Terraform dependency cycle.

variable "service_account_email" {
  type        = string
  description = "Email of the runtime SA created at the env level"
}

// Cloud SQL client — required for the cloudsql-instances annotation.
resource "google_project_iam_member" "runtime_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${var.service_account_email}"
}

resource "google_storage_bucket_iam_member" "runtime_photos_admin" {
  bucket = var.photos_bucket
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.service_account_email}"
}

resource "google_storage_bucket_iam_member" "runtime_uploads_admin" {
  bucket = var.uploads_bucket
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.service_account_email}"
}

resource "google_cloud_run_v2_service" "web" {
  project  = var.project_id
  name     = "breadly-web-${var.env}"
  location = var.region

  // Public ingress; auth is in-app via Clerk, not at the platform edge.
  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = var.service_account_email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    timeout = "60s"

    containers {
      image = var.image

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "BREADLY_ENV"
        value = var.env
      }
      env {
        name  = "CLOUDSQL_CONNECTION_NAME"
        value = var.cloudsql_connection_name
      }
      env {
        name  = "PHOTOS_BUCKET"
        value = var.photos_bucket
      }
      env {
        name  = "UPLOADS_BUCKET"
        value = var.uploads_bucket
      }
      env {
        name  = "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
        value = var.clerk_publishable_key
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["database_url"]
            version = "latest"
          }
        }
      }
      env {
        name = "CLERK_SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["clerk_secret_key"]
            version = "latest"
          }
        }
      }
      env {
        name = "CLERK_WEBHOOK_SECRET"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["clerk_webhook_secret"]
            version = "latest"
          }
        }
      }
      env {
        name = "RESEND_API_KEY"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["resend_api_key"]
            version = "latest"
          }
        }
      }

      // Cloud SQL Auth Proxy via the platform-native annotation.
      // Requires roles/cloudsql.client on the SA (granted above).
      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [var.cloudsql_connection_name]
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

// Public-internet access to the service (auth happens in-app).
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = google_cloud_run_v2_service.web.location
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "service_url" { value = google_cloud_run_v2_service.web.uri }
output "service_name" { value = google_cloud_run_v2_service.web.name }
