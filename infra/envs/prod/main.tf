provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  env = "prod"
}

module "project_services" {
  source     = "../../modules/project_services"
  project_id = var.project_id
}

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = "breadly-web-${local.env}"
  display_name = "Cloud Run runtime SA — breadly-web (${local.env})"

  depends_on = [module.project_services]
}

// Required for v4 signed-URL minting via IAM SignBlob (no private key in
// the runtime; SA signs blobs as itself).
resource "google_service_account_iam_member" "runtime_sign_self" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.runtime.email}"
}

module "database" {
  source              = "../../modules/database"
  project_id          = var.project_id
  region              = var.region
  env                 = local.env
  tier                = "db-g1-small"
  high_availability   = true
  deletion_protection = true
  db_password         = var.db_password

  depends_on = [module.project_services]
}

module "storage" {
  source     = "../../modules/storage"
  project_id = var.project_id
  region     = var.region
  env        = local.env

  depends_on = [module.project_services]
}

module "registry" {
  source     = "../../modules/registry"
  project_id = var.project_id
  region     = var.region
  env        = local.env

  depends_on = [module.project_services]
}

module "secrets" {
  source                        = "../../modules/secrets"
  project_id                    = var.project_id
  env                           = local.env
  runtime_service_account_email = google_service_account.runtime.email
  cloudsql_connection_name      = module.database.connection_name
  db_user                       = module.database.app_user
  db_name                       = module.database.database_name
  db_password                   = var.db_password

  depends_on = [module.project_services]
}

module "runtime" {
  source                   = "../../modules/runtime"
  project_id               = var.project_id
  region                   = var.region
  env                      = local.env
  image                    = var.image
  service_account_email    = google_service_account.runtime.email
  cloudsql_connection_name = module.database.connection_name
  photos_bucket            = module.storage.photos_bucket
  uploads_bucket           = module.storage.uploads_bucket
  secret_ids               = module.secrets.secret_ids
  clerk_publishable_key    = var.clerk_publishable_key
  min_instances            = 1 // keep one warm in prod
  max_instances            = 10
}
