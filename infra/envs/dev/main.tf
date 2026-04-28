provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  env = "dev"
}

module "project_services" {
  source     = "../../modules/project_services"
  project_id = var.project_id
}

// SA created at env level — both runtime (uses it) and secrets (binds IAM
// to it) reference this, breaking what would otherwise be a module cycle.
resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = "breadly-web-${local.env}"
  display_name = "Cloud Run runtime SA — breadly-web (${local.env})"

  depends_on = [module.project_services]
}

module "database" {
  source              = "../../modules/database"
  project_id          = var.project_id
  region              = var.region
  env                 = local.env
  tier                = "db-f1-micro"
  high_availability   = false
  deletion_protection = false
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
  min_instances            = 0
  max_instances            = 4
  dev_mode                 = true
}
