output "service_url" { value = module.runtime.service_url }
output "service_account_email" { value = google_service_account.runtime.email }
output "cloudsql_connection_name" { value = module.database.connection_name }
output "registry_url" { value = module.registry.repository_url }
output "photos_bucket" { value = module.storage.photos_bucket }
output "uploads_bucket" { value = module.storage.uploads_bucket }
output "tiles_bucket" { value = module.storage.tiles_bucket }
output "secret_ids" { value = module.secrets.secret_ids }
