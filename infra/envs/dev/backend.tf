// Remote state in GCS. The bucket must exist before `terraform init`:
//
//   gcloud storage buckets create gs://breadly-tfstate-<random> \
//     --project=<your-dev-project> --location=us-central1 \
//     --uniform-bucket-level-access
//   gcloud storage buckets update gs://breadly-tfstate-<random> --versioning
//
// Then set bucket name below or via `terraform init -backend-config=...`.

terraform {
  backend "gcs" {
    // bucket = "breadly-tfstate-XXXX"   <- set via -backend-config or edit
    prefix = "envs/dev"
  }
}
