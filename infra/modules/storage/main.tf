// Three buckets:
//   * photos:  listing photos, public read, served direct to clients
//   * uploads: signed-URL uploads from browsers; private; lifecycle deletes
//              orphans after 24h (uploads that never got attached to a listing)
//   * tiles:   Protomaps PMTiles for the map view; public read; long cache
//
// Uniform bucket-level access on all three (no per-object ACLs — IAM only).

variable "project_id" { type = string }
variable "region" { type = string }
variable "env" { type = string }

locals {
  prefix = "breadly-${var.env}"
}

resource "google_storage_bucket" "photos" {
  project                     = var.project_id
  name                        = "${local.prefix}-photos"
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  force_destroy               = var.env != "prod"

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT"]
    response_header = ["Content-Type", "Content-MD5"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket_iam_member" "photos_public_read" {
  bucket = google_storage_bucket.photos.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_storage_bucket" "uploads" {
  project                     = var.project_id
  name                        = "${local.prefix}-uploads"
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  force_destroy               = var.env != "prod"

  lifecycle_rule {
    condition {
      age = 1 // delete orphan uploads older than 24h
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = ["*"]
    method          = ["PUT", "POST", "GET", "HEAD"]
    response_header = ["Content-Type", "Content-MD5"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket" "tiles" {
  project                     = var.project_id
  name                        = "${local.prefix}-tiles"
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  force_destroy               = var.env != "prod"
}

resource "google_storage_bucket_iam_member" "tiles_public_read" {
  bucket = google_storage_bucket.tiles.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

output "photos_bucket" { value = google_storage_bucket.photos.name }
output "uploads_bucket" { value = google_storage_bucket.uploads.name }
output "tiles_bucket" { value = google_storage_bucket.tiles.name }
