# Breadly — Infrastructure

Terraform stacks for the two GCP environments (`dev`, `prod`). All resources are project-scoped — bring your own GCP project per env.

## Layout

```
infra/
├── envs/
│   ├── dev/        # composes the modules for the dev environment
│   └── prod/       # composes the modules for the prod environment
└── modules/
    ├── project_services/   # enables required GCP APIs
    ├── database/           # Cloud SQL Postgres (PostGIS enabled by app migration)
    ├── storage/            # photos + uploads + tiles buckets
    ├── registry/           # Artifact Registry Docker repo
    ├── secrets/            # Secret Manager entries + IAM
    └── runtime/            # Cloud Run service + IAM bindings
```

## What you need first

1. Two GCP projects (e.g. `breadly-dev-XXXX` and `breadly-prod-XXXX`). Free credits work fine.
2. A GCS bucket for Terraform state, **per env**:

   ```bash
   gcloud storage buckets create gs://breadly-tfstate-dev-$(uuidgen | tr 'A-Z' 'a-z' | head -c 8) \
     --project=<your-dev-project> \
     --location=us-central1 \
     --uniform-bucket-level-access
   gcloud storage buckets update gs://breadly-tfstate-dev-XXXX --versioning
   ```

3. `gcloud auth application-default login`
4. Terraform ≥ 1.6 and `gcloud` CLI installed.
5. Billing enabled on each project.

## First apply (dev)

```bash
cd infra/envs/dev

# Bring your bucket name in.
terraform init -backend-config="bucket=breadly-tfstate-dev-XXXX"

# Set your variables.
cp terraform.tfvars.example terraform.tfvars
$EDITOR terraform.tfvars     # set project_id, db_password, clerk_publishable_key

terraform plan
terraform apply

# Populate real secrets (placeholders are 'REPLACE_ME').
echo -n "<the same db_password you used>" | gcloud secrets versions add breadly-dev-db_password --data-file=-
echo -n "sk_test_..."                      | gcloud secrets versions add breadly-dev-clerk_secret_key --data-file=-
echo -n "whsec_..."                        | gcloud secrets versions add breadly-dev-clerk_webhook_secret --data-file=-
echo -n "<resend_api_key>"                 | gcloud secrets versions add breadly-dev-resend_api_key --data-file=-
```

After this, `terraform output service_url` gives you the Cloud Run URL. The first apply uses the public Cloud Run "hello" image as a placeholder; CI overwrites it on the next merge.

## What's not in here yet

- **VPC + Serverless VPC Connector** — we use public-IP Cloud SQL with the Cloud Run native `cloudsql-instances` proxy for now. Cleanly upgradable later by adding a `network` module and switching `database.ip_configuration` to private.
- **Custom domain** — defer until Cloud Run is up.
- **CI deployment IAM (Workload Identity Federation)** — wired in E1.7. Until then, deploys are manual: `gcloud run deploy --image <new image>`.
- **Cloud Logging / monitoring dashboards** — stock Cloud Run logs are sufficient for E1.

## Conventions

- One module = one well-scoped concern; modules don't talk to each other directly. Cross-module wiring lives in the env composition (`envs/<env>/main.tf`).
- The Cloud Run runtime SA is created in the env composition (not inside the runtime module) so the secrets module can also reference it without a Terraform cycle.
- Secret values are placeholders (`REPLACE_ME`) on first apply; rotate via `gcloud secrets versions add` immediately. Do not put real secrets in tfvars files.
- `force_destroy` is `true` on dev buckets, `false` on prod. `deletion_protection` likewise on the SQL instance.
