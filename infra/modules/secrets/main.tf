// Secret Manager secrets used by the runtime.
//
// `database_url` is composed by Terraform from the SQL connection name +
// app password — Terraform already knows both, so we save the operator a
// gcloud step. Other secrets are seeded with REPLACE_ME placeholders;
// rotate via:
//   echo -n "<value>" | gcloud secrets versions add breadly-<env>-<key> --data-file=-

variable "project_id" { type = string }
variable "env" { type = string }
variable "runtime_service_account_email" { type = string }

variable "cloudsql_connection_name" {
  type        = string
  description = "project:region:instance — used to compose database_url"
}
variable "db_user" { type = string }
variable "db_name" { type = string }
variable "db_password" {
  type      = string
  sensitive = true
}

locals {
  // app reads DATABASE_URL; on Cloud Run this hits the SQL Auth Proxy via
  // the unix socket the cloudsql-instances annotation mounts at /cloudsql.
  database_url = "postgres://${var.db_user}:${urlencode(var.db_password)}@/${var.db_name}?host=/cloudsql/${var.cloudsql_connection_name}"

  placeholder_secrets = {
    clerk_secret_key     = "Clerk backend secret key (sk_...)"
    clerk_webhook_secret = "Clerk webhook signing secret (whsec_...)"
    resend_api_key       = "Resend API key"
  }
}

resource "google_secret_manager_secret" "database_url" {
  project   = var.project_id
  secret_id = "breadly-${var.env}-database_url"

  labels = {
    env = var.env
    app = "breadly"
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = local.database_url
}

resource "google_secret_manager_secret" "placeholder" {
  for_each = local.placeholder_secrets

  project   = var.project_id
  secret_id = "breadly-${var.env}-${each.key}"

  labels = {
    env = var.env
    app = "breadly"
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "placeholder" {
  for_each = google_secret_manager_secret.placeholder

  secret      = each.value.id
  secret_data = "REPLACE_ME"
}

// Grant the runtime SA access to read every secret.
resource "google_secret_manager_secret_iam_member" "database_url_access" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.database_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.runtime_service_account_email}"
}

resource "google_secret_manager_secret_iam_member" "placeholder_access" {
  for_each = google_secret_manager_secret.placeholder

  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.runtime_service_account_email}"
}

output "secret_ids" {
  value = merge(
    { database_url = google_secret_manager_secret.database_url.secret_id },
    { for k, s in google_secret_manager_secret.placeholder : k => s.secret_id },
  )
}
