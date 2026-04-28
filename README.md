# Breadly

A real two-sided marketplace for time-bound artisan bread. Built on GCP (Cloud Run + Cloud SQL + Cloud Storage) with Terraform, Next.js 16 / React 19, Postgres + PostGIS, Drizzle, and Clerk.

> **Status**: Epic E1 (foundations) complete. The four feed-shape mockup routes (`/a /b /c /d`) now read from a real Postgres + PostGIS database seeded with 30 Boulder-area bakers and ~100 listings. See [`design-docs/02-epics.md`](./design-docs/02-epics.md) for the M1 → M5 plan.

## Repo layout

```
breadly-v2/
├── design-docs/        # product + engineering decisions (read these first)
│   ├── 01-product-design.md
│   └── 02-epics.md
├── compass/            # PM thinking log (strategy / framing)
│   └── COMPASS.md
├── infra/              # Terraform IaC for GCP (dev + prod)
│   ├── README.md
│   ├── envs/{dev,prod}/
│   └── modules/        # project_services, database, storage, registry, secrets, runtime
├── web/                # Next.js 16 application
│   ├── src/
│   │   ├── app/        # routes
│   │   ├── db/         # Drizzle schema + migrations + seed
│   │   └── lib/        # queries (server) + types + format + UI atoms
│   ├── drizzle/        # generated migration SQL (committed)
│   └── Dockerfile
├── docker-compose.yml  # local Postgres+PostGIS for `npm run dev`
└── .github/workflows/  # CI: typecheck + DB roundtrip + Terraform validate + Cloud Run deploy
```

## Local dev (60-second setup)

Prereqs: Node ≥ 22, Docker, [Clerk dev account](https://dashboard.clerk.com).

```bash
# 1. Postgres
docker compose up -d

# 2. App deps
cd web
npm install

# 3. Env
cp .env.local.example .env.local
# Edit .env.local: paste your Clerk pk_test_ + sk_test_ keys.
# DATABASE_URL is already set for the docker-compose Postgres.

# 4. Migrate + seed Boulder
npm run db:migrate
npm run db:seed

# 5. Run
npm run dev
# http://localhost:3000  →  test menu
# /a /b /c /d            →  the four feed variants on real DB data
```

`npm run db:reset` re-seeds from scratch when you've made schema changes.
`npm run db:studio` opens Drizzle Studio against your local DB.

## Deploy to GCP

See [`infra/README.md`](./infra/README.md) for the Terraform-driven deploy. Short version:

1. Create two GCP projects (dev, prod) and a per-env Terraform state bucket.
2. `terraform init -backend-config="bucket=…"` then `terraform apply` in `infra/envs/dev`.
3. Push to `main` — CI builds the image, pushes to Artifact Registry, deploys to Cloud Run.

Required GitHub secrets for the deploy job: `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`, `GCP_PROJECT`, `GCP_REGION`, `ARTIFACT_REPO`, `CLERK_PUBLISHABLE_KEY`. WIF setup (no JSON keys) is documented in `infra/README.md`.

## Universal-laws compliance highlights

- **One source of truth**: Drizzle schema (`web/src/db/schema.ts`) is the only place table shapes are defined; UI types in `web/src/lib/types.ts` are explicitly *projections* shaped for the UI, not parallel definitions. ([LAW:one-source-of-truth])
- **Single mechanism for tags**: `tags` table + `listing_tags` junction + `eater_preferences` include/exclude arrays serve filter, match, notify, and bounty matching. No parallel allergen/dietary subsystems. ([LAW:single-enforcer])
- **One type per behavior**: A user is a single `users` row. Eater / baker / operator are *capabilities* on that record (`canBake`, `canOperate`), not separate user types. ([LAW:one-type-per-behavior])
- **Variability lives in data**: Listing presentation across the four feed variants varies entirely in how the same query result is *displayed*; the underlying query and data shape are identical. ([LAW:dataflow-not-control-flow])
- **Goals are machine-verifiable**: `npm run db:migrate && npm run db:seed && npm run build` either succeeds or doesn't — every E1 done-condition is mechanically checkable.

## What's next

E2: real signup → onboarding → claim → handoff loop. See `design-docs/02-epics.md`.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 / React 19 / TS | RSC fits map+list views; fast iteration |
| Styling | Tailwind 4 | Standard, fast, brand pass coming |
| Auth | Clerk | Vendor-locked but fast; trade accepted |
| DB | Postgres 16 + PostGIS | Real radius queries, mature ecosystem |
| ORM | Drizzle | Typed, no runtime overhead |
| Hosting | Cloud Run | Containerized, scale-to-zero, low cost |
| IaC | Terraform | Production-shape from day 1 |
| CI/CD | GitHub Actions + WIF | No JSON service-account keys |
