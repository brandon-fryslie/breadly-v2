terraform {
  backend "gcs" {
    // bucket = "breadly-tfstate-XXXX"   <- set via -backend-config or edit
    prefix = "envs/prod"
  }
}
