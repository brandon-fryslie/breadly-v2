output "service_url" {
  value       = module.runtime.service_url
  description = "Cloud Run URL — open this after a successful apply"
}

output "service_account_email" {
  value = google_service_account.runtime.email
}

output "cloudsql_connection_name" {
  value = module.database.connection_name
}

output "cloudsql_public_ip" {
  value = module.database.public_ip
}

output "registry_url" {
  value       = module.registry.repository_url
  description = "Push images here: docker push <this>/breadly-web:<tag>"
}

output "photos_bucket" { value = module.storage.photos_bucket }
output "uploads_bucket" { value = module.storage.uploads_bucket }
output "tiles_bucket" { value = module.storage.tiles_bucket }

output "secret_ids" {
  value = module.secrets.secret_ids
}
