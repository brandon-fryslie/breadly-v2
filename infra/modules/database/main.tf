// Cloud SQL Postgres instance + database + app user.
//
// Public IP with Cloud SQL Auth Proxy access (Cloud Run's native
// cloudsql-instances annotation handles the proxy automatically).
// Public IP keeps E1 free of VPC + Serverless Connector setup; we can
// flip to private IP later without changing the app — only the runtime
// module needs to grow a connector.
//
// PostGIS is enabled by the migration script (CREATE EXTENSION) since
// Terraform doesn't manage in-database state cleanly.

variable "project_id" { type = string }
variable "region" { type = string }
variable "env" { type = string }
variable "tier" {
  type        = string
  description = "Cloud SQL machine tier"
  default     = "db-f1-micro"
}
variable "deletion_protection" {
  type    = bool
  default = false
}
variable "high_availability" {
  type    = bool
  default = false
}
variable "db_password" {
  type      = string
  sensitive = true
}

resource "google_sql_database_instance" "main" {
  project          = var.project_id
  name             = "breadly-${var.env}"
  region           = var.region
  database_version = "POSTGRES_16"

  deletion_protection = var.deletion_protection

  settings {
    tier    = var.tier
    edition = "ENTERPRISE" // [LAW:no-mode-explosion] shared-core tiers (db-f1-micro/g1-small) require ENTERPRISE; ENTERPRISE_PLUS rejects them
    availability_type = var.high_availability ? "REGIONAL" : "ZONAL"
    disk_size         = 10
    disk_autoresize   = true
    disk_type         = "PD_SSD"

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = var.env == "prod"
      start_time                     = "07:00" // UTC = 1am Boulder
    }

    ip_configuration {
      ipv4_enabled = true
      // Authorized networks are managed externally for now (operator IP for
      // psql access). App access goes through the Cloud SQL Auth Proxy and
      // does not need an authorized network entry.
    }

    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }

    insights_config {
      query_insights_enabled  = true
      record_application_tags = true
      record_client_address   = false
    }
  }
}

resource "google_sql_database" "app" {
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  name     = "breadly"
}

resource "google_sql_user" "app" {
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  name     = "breadly_app"
  password = var.db_password
}

output "connection_name" {
  value       = google_sql_database_instance.main.connection_name
  description = "project:region:instance — used by Cloud Run cloudsql-instances annotation"
}

output "instance_name" {
  value = google_sql_database_instance.main.name
}

output "database_name" {
  value = google_sql_database.app.name
}

output "app_user" {
  value = google_sql_user.app.name
}

output "public_ip" {
  value = google_sql_database_instance.main.public_ip_address
}
