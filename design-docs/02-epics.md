# Breadly — Epic Plan

Engineering decomposition of `01-product-design.md` into shippable epics, sequenced so each milestone is a coherent demoable cut. Lives alongside the product design doc, not above it — when the product doc and this doc disagree, the product doc wins and this doc gets revised.

> **Where the work actually lives.** This document is the *plan*. The active backlog lives in `lit` (the issue tracker; DB at `.git/links/dolt`). Open tickets, status, dependencies, and rank are all there. Use `lit ready` for the next-up queue and `lit ls` to browse. New work goes into `lit` first; this doc gets revised when the *strategy* changes, not when individual tickets move.

**Mapping doc → tracker:**
- M0 / E1 — shipped historically; not tracked.
- M1 → ED1 + ED2 (demo-cut rollups absorb E2/E3/E4/E5/E6/E7/E8/E9 partial).
- M3 / E10 — its own epic in `lit` with two child tasks.
- M4 / E11, E12 — epic-level only in `lit`; decompose when staffing M4.
- M5 / E14, E15 — epic-only; further out → higher level.
- Cross-cutting: golden-path Playwright (`CX-1`), photo-required (`CX-2`), filter-sprawl audit (`CX-3`) are real tickets in `lit`. Universal-laws / mock-vs-document discipline / privacy gradient stay as guidelines below.

**Standing decisions carried in from `compass/`:**
- Straddle portfolio + real-business framings. Designs must satisfy both bars.
- Supply density is the gating crux for the real-business read; eater first-session activation is the gating crux for the portfolio read. M1 + M2 attack both.
- Variability lives in data (tags, statuses, discriminated unions), not in control flow. The tag system is *one mechanism* serving filter / notify / match / bounty.

**This is a real platform, not a mockup.** The signup flows, baker portal, eater portal, listing post/discover/claim/handoff loop, schedules, bounties, ratings — all real, working against a real DB, with real auth. Only the categories called out in `01-product-design.md` §7 (payments, KYC, delivery, legal/compliance) are mocked. Portfolio target is platform/systems engineering depth, hence GCP + Terraform from day 1.

---

## Stack (committed)

| Concern | Pick | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TS | Already scaffolded; SSR + RSC fits map+list well |
| Styling | Tailwind 4 + a brand-forward design pass via `frontend-design` skill | Portfolio target wants real visual identity, not generic |
| Hosting (app) | Cloud Run (containerized) | User wants GCP exposure; Cloud Run is right-sized; scales to zero |
| DB | Cloud SQL for Postgres + PostGIS extension | Managed Postgres on GCP; PostGIS is non-negotiable for geo radius |
| ORM | Drizzle | Typed, migration-friendly, no runtime overhead |
| Auth | Clerk | Picked for speed; vendor lock accepted as a trade |
| Real-time | Postgres LISTEN/NOTIFY → SSE from Cloud Run; upgrade path to Pub/Sub if needed | Single source of truth; Cloud Run supports SSE on long-lived requests |
| Maps | MapLibre GL + Protomaps tiles served from a Cloud Storage bucket | No Mapbox token gating; full control |
| Geo | PostGIS (radius queries, neighborhood polygons) | The real answer; portfolio wants to show real geo |
| File storage | Cloud Storage bucket per env, signed URLs for upload | GCP-native; integrates with IAM |
| Secrets | Secret Manager | No env-vars-in-CI nonsense |
| Image registry | Artifact Registry | Where Cloud Run pulls from |
| IaC | Terraform — `infra/` directory, separate `dev` + `prod` workspaces | User explicitly wants this for GCP learning |
| CI/CD | GitHub Actions: typecheck + test + build image + push to Artifact Registry; Cloud Run deploys on tag (or per-PR preview later) | Standard, no Cloud Build dependency |
| Notifications | Email via Resend; web push deferred; SMS deferred | Email is the table-stakes channel |
| Testing | Vitest (unit) + Playwright (E2E for W3 → W11 → W14 golden path) | Vitest for unit, Playwright for the cold-core demo |
| Geographic anchor | **Boulder, Colorado** — real neighborhoods, real lat/lng | Per user; replaces the temporary Hawthorne/Portland data |

**GCP layout (target):**
- Two GCP projects: `breadly-dev` and `breadly-prod`. Terraform manages both via workspaces.
- Region: `us-central1` (Iowa) — closest to Boulder, cheapest.
- Cloud Run service: `breadly-web`, public, custom domain deferred.
- Cloud SQL: small (`db-f1-micro` for dev, `db-g1-small` for prod), private IP, accessed from Cloud Run via the Cloud SQL connector.
- Cloud Storage buckets: `breadly-{env}-photos` (public read for listing photos), `breadly-{env}-uploads` (private, signed-URL uploads), `breadly-{env}-tiles` (public, Protomaps).
- Secret Manager: DB password, Clerk keys, Resend key.
- Artifact Registry: `breadly-images` repo, regional.

**Terraform `apply` is the user's job.** Modules will be code-only; they assume `gcloud auth application-default login` has happened locally and the user runs `terraform apply` themselves.

---

## Milestone overview

| | Milestone | Demo headline | Epics |
|---|---|---|---|
| **M0** | Foundations | (no demo yet) | E1 |
| **M1** | Cold core loop | "I can post a loaf and someone can pick it up" | E2 · E3 · E4 · E5 |
| **M2** | Bakers feel real | "Bakers run a real storefront with a schedule" | E6 · E7 · E8 |
| **M3** | Engagement loops | "Eaters come back; bounties pull supply" | E9 · E10 |
| **M4** | Mock veneer | "Looks and feels like a real product end-to-end" | E11 · E12 · E13 |
| **M5** | The moat + polish | "Bakers see demand; everything updates live" | E14 · E15 |
| **MD** | **Demo-ready cut (investor-shaped)** | "Walk an investor through baker + eater + admin in 10 minutes" | **ED1 · ED2 · ED3 · ED4 · ED5** |

Total: 15 slice-epics across 5 milestones, plus 5 demo-shaped rollup epics (ED1–ED5) defined further down. Slice-epics are how the work is decomposed; demo-epics are how "done enough to show" is measured.

---

## M0 — Foundations

### E1 — Project foundations

- **Goal:** dev environment + GCP deploy target + Terraform IaC + schema + seed + CI all working before any feature work. The platform-engineering substrate.
- **Scope (in):**
  - **Terraform** in `infra/`:
    - Module: `project` — enables required APIs (run, sql, secretmanager, storage, artifactregistry, vpcaccess, iam).
    - Module: `network` — VPC + subnet + Serverless VPC connector for Cloud Run → Cloud SQL.
    - Module: `database` — Cloud SQL Postgres instance with PostGIS, private IP, automated backups.
    - Module: `storage` — three buckets (photos public-read, uploads private, tiles public-read).
    - Module: `registry` — Artifact Registry Docker repo.
    - Module: `runtime` — Cloud Run service `breadly-web`, service account, IAM bindings, VPC connector attachment, env wiring.
    - Module: `secrets` — Secret Manager entries (DB password, Clerk keys, Resend key) with IAM access for the Cloud Run SA.
    - Workspaces: `dev` and `prod` with separate state.
    - README in `infra/` documenting `terraform apply` steps user runs against their own project.
  - **App scaffolding (extending existing `web/`):**
    - Drizzle schema (`web/src/db/schema/`) for: `users`, `baker_profiles`, `listings`, `tags`, `listing_tags`, `eater_preferences`, `claims`, `bounties`, `schedules`, `ratings`, `follows`, `subscriptions`, `notifications`. Detailed shapes in a follow-up `03-data-model.md`.
    - Migrations via `drizzle-kit`. `npm run db:migrate`, `db:reset`, `db:seed`.
    - Seed script generating ~30 bakers and ~100 listings + ~40 scheduled bakes anchored on Boulder neighborhoods (Newlands, Mapleton Hill, North Boulder, Goss Grove, University Hill, Whittier, Martin Acres, Table Mesa). Real lat/lng. Replaces the mockup data currently in `web/src/lib/data.ts`.
    - Clerk integration: middleware, sign-in/up routes, `useUser()` wired through, webhook handler that mirrors Clerk users into `users` table on create.
    - `.env.example`, `web/Dockerfile`, `web/.dockerignore`, `web/README.md` with both local-dev and deploy instructions.
  - **CI:** GitHub Actions workflow `ci.yml` — typecheck, lint (when added), Vitest, Playwright smoke test against a Postgres service container, Docker image build on `main`, push to Artifact Registry.
  - **Local dev:** docker-compose for Postgres+PostGIS so `npm run dev` works without GCP. `.env.local` example reads same keys as Cloud Run.
- **Scope (out):** any feature code (no signup beyond Clerk's defaults; no listing creation; no claim flow); map tile provider seeding (defer to E5); custom domain (defer); production-traffic CD (defer to a later epic).
- **Dependencies:** none.
- **Workflows covered:** none directly — unblocks all of M1.
- **Done when:**
  1. `cd infra && terraform plan -workspace=dev` produces a clean plan in user's GCP project.
  2. `cd web && docker-compose up -d && npm install && npm run db:migrate && npm run db:seed && npm run dev` works on a fresh clone, with the four feed variants now rendering Boulder bakers from Postgres.
  3. CI workflow passes on a PR.
  4. README in repo root documents both flows clearly enough for someone else to run them.

---

## M1 — Cold core loop

The smallest end-to-end thing that proves the product exists: a baker can post a loaf, an eater can find it, claim it, and pick it up.

### E2 — Auth + identity + roles

- **Goal:** real users with persistent identity; role model that supports baker/eater/both/operator without fragmenting the codebase.
- **Scope (in):**
  - Email + Google OAuth via Clerk (hosted sign-in/sign-up; user mirror to local `users` via webhook).
  - User has a single account; capabilities are flags (`canBake`, `canOperate`) — *not* separate user types. (One-type-per-behavior; eater-vs-baker is a capability set, not a discriminator.)
  - `/auth/sign-in`, `/auth/sign-up`, sign-out, session middleware.
  - Profile basics: display name, avatar, address (geocoded once at save).
  - Capability switching: a single user can be both eater and baker; the UI shows the eater app by default and exposes a "Baker mode" toggle when `canBake`.
- **Scope (out):** identity *verification* for bakers (E12, mocked).
- **Dependencies:** E1.
- **Workflows covered:** part of W1 (Onboard).
- **Done when:** a new user can sign up, claim baker capability, and see both eater and baker landing surfaces.

### E3 — Listings + tags + post-a-loaf

- **Goal:** a baker can put a loaf on the platform; eaters can see it. The single tag mechanism that the rest of the system reuses.
- **Scope (in):**
  - `Listing` model with: type, name, photo, price, qty, ready time (past or future), out-of-oven timestamp, status (`scheduled` / `ready` / `claimed` / `picked_up` / `cancelled`), expiry policy, geographic point.
  - Tag system: one `tags` table covering style, dietary, ingredient, kitchen properties. Listings carry tags; eaters carry include/exclude tag preferences. **Same mechanism for filter, match, notify, bounty-match — no special-cases.**
  - W3 hot-path: one-page "post a loaf" form with photo upload, type, qty, price, ready time, tag picker. Live in <30s.
  - Listing-detail page with full info; claim button (claim itself ships in E4).
  - Auto-hide on baker-configurable cutoff (default 24h after ready).
- **Scope (out):** scheduled/recurring (E7); allergen disclaimers UI polish (handled at tag-system level, no special subsystem).
- **Dependencies:** E1, E2.
- **Workflows covered:** W3, partial W11 (the listing-detail half), W16 (preference editor).
- **Done when:** a baker can post a loaf in <30s and an eater can see it on a listing-detail URL with all attributes correct.

### E4 — Claim + handoff loop

- **Goal:** the actual transaction surface — reserve, get pickup code, confirm handoff. No real money (mocked in E11).
- **Scope (in):**
  - Claim flow: tap → confirm → receive pickup code + exact address + map directions.
  - Pickup-code mechanic: 4-digit code shown to one party, entered/tapped by the other; both sides see "complete" simultaneously.
  - State transitions: `ready` → `claimed` → `picked_up`. Cancellation paths for both sides; no-show tracking.
  - "My claims" page (W11 follow-through): active, upcoming, past.
  - Privacy gradient: pre-claim shows neighborhood + fuzzed pin; post-claim shows exact address.
- **Scope (out):** payments (E11); ratings (E8); subscriptions (E9).
- **Dependencies:** E3.
- **Workflows covered:** W11 (claim/reserve), W14 (handoff).
- **Done when:** Playwright test runs the full W3→W11→W14 path end-to-end against a fresh seed.

### E5 — Eater home feed (four variants, real data)

- **Goal:** replace the static mockups in `web/src/app/{a,b,c,d}/` with live DB-backed feeds. All four ship; no default chosen yet.
- **Scope (in):**
  - Server components query Postgres (with PostGIS radius) for nearby listings + schedule entries; pass to the existing presentation components.
  - Four routes stay (`/a`, `/b`, `/c`, `/d`) so user-testing can continue with real data.
  - `/` becomes the eater home, defaulting to one variant (TBD — until we have test data, default to **A — Density**, since it's the lowest-bias presentation: "show me everything, let me decide").
  - A `?variant=` query param + a feature-flag column on `users` lets us A/B different defaults per user.
  - List + map stay synchronized in variant A (selection in one highlights the other).
- **Scope (out):** real-time updates (E15); notifications (E9); the "scheduled-future" toggle on variant A (deferred to E7 when scheduled bakes exist as a real concept).
- **Dependencies:** E3.
- **Workflows covered:** W9 (Discover-now), W10 (Discover-planned), W16 (preference filter chip).
- **Done when:** all four variant URLs render the same DB-backed reality, and switching between them changes presentation without re-fetching data.

**M1 demo:** "Sign up. Claim baker mode. Post a loaf. Sign in as someone else. See the loaf in the feed. Claim it. Walk through the pickup-code flow. Both screens read 'picked up.'"

---

## M2 — Bakers feel like real bakers

Supply-density crux: bakers won't generate density unless the baker tools feel worth their time. M2 is the baker-side investment that makes M3's engagement loops have something to engage with.

### E6 — Baker public storefront

- **Goal:** every baker has a real, shareable, indexable URL.
- **Scope (in):**
  - `/b/<slug>` page with bio, photo, current schedule (next 7 days), live listings, ratings (placeholder until E8), kitchen tags.
  - Slug picker on baker onboarding; uniqueness enforced.
  - OG/Twitter meta so the URL renders nicely when pasted into Instagram.
  - Public, indexable, no auth required.
- **Scope (out):** follow button (E9); ratings (E8) — both placeholders for now.
- **Dependencies:** E2, E3.
- **Workflows covered:** W5.
- **Done when:** a baker pastes their `/b/<slug>` into Instagram and the link preview is photo + name + tagline.

### E7 — Baker schedule + planned bakes

- **Goal:** scheduled bakes as first-class inventory. Eaters reserve forward; the variant D mockup gets real.
- **Scope (in):**
  - `Schedule` model: recurring (cron-like) or one-off; baker-defined.
  - Materialization: a job (cron or on-read) materializes scheduled entries into `Listing` rows with `status='scheduled'` and `readyAt` in the future.
  - Calendar editor for bakers (W2): create recurring "Country sourdough, Tue+Fri 6am, 8 loaves."
  - Eater-side: planned listings appear in variant D's calendar and in variant A's "ready by future time" mode.
  - Reserve-forward flow: eater can claim a `scheduled` listing; transitions to `claimed` immediately; the loaf is held when it actually bakes.
- **Scope (out):** subscription (E9); demand insights (E14).
- **Dependencies:** E3, E4, E6.
- **Workflows covered:** W2, W10.
- **Done when:** a baker creates a recurring Tuesday bake; an eater reserves one for next Tuesday; on Tuesday it materializes correctly and both see "claimed."

### E8 — Baker today / dashboard + ratings

- **Goal:** the baker's daily-driver screen + the two-sided reputation system.
- **Scope (in):**
  - `/baker/today` (W4): live listings, scheduled today, claimed seats, handoffs pending, pickup codes ready.
  - Mark handoffs done; mark no-shows; pull a listing.
  - Ratings (W8 + W15): post-handoff, both sides rate each other (thumbs + optional comment + tags). Aggregate ratings on storefront and listing detail.
  - History view: past bakes, claim list, reviews.
- **Scope (out):** demand insights (E14); earnings/payout dashboard (E11).
- **Dependencies:** E4, E6.
- **Workflows covered:** W4, W8, W15.
- **Done when:** a baker can run a Saturday morning bake from a single screen — see who's coming, mark handoffs, accept feedback.

**M2 demo:** "Here's a baker. Real storefront. Real schedule. Real today-screen. They can run a morning of bakes from one page. Eaters rate them; ratings show on the storefront."

---

## M3 — Engagement loops

The retention loop and the reverse channel. M3 is what turns a one-time transaction into a habit and what lets eaters pull supply that doesn't yet exist.

### E9 — Notifications + follows + subscriptions

- **Goal:** "a gluten-free sourdough you'd love is scheduled Saturday 0.4mi away" is the moment of magic. This epic builds it.
- **Scope (in):**
  - Follow a baker, follow a tag-set ("any rye within 2mi"), subscribe to a recurring listing ("the Tuesday country loaf, weekly").
  - Notification engine: matches new listings/schedules against follow records; produces `notifications` rows.
  - Delivery: in-app (notification center), email (Resend), web push (deferred behind a flag).
  - Subscription auto-claim: when a baker confirms a scheduled bake matches an active subscription, the subscriber is auto-claimed.
- **Scope (out):** SMS; ML-driven recommendations.
- **Dependencies:** E3, E7.
- **Workflows covered:** W13.
- **Done when:** an eater follows a baker; that baker schedules a bake; the eater receives a notification within ~30s.

### E10 — Bounties (the reverse channel)

- **Goal:** eater posts what they want; bakers see and accept. Demand pulls supply when supply is sparse.
- **Scope (in):**
  - Eater bounty composer (W12): type, tags, ready-by, price ceiling, radius.
  - Bounty matching: re-uses tag mechanism from E3 — *no separate matcher*. Matches against baker kitchen-tags + capacity.
  - Public bounty board `/bounties` (browseable by anyone, claimable by bakers).
  - Baker bounty inbox: open bounties matching me; accept / counter-offer / dismiss (W7).
  - Accepted bounty becomes a `scheduled` listing tied to the eater (auto-claimed on bake).
- **Scope (out):** payment escrow for bounties (mocked in E11 like everything else).
- **Dependencies:** E3, E7, E9.
- **Workflows covered:** W7, W12.
- **Done when:** an eater posts a rye bounty for Saturday; Rivka's Rye sees it in her inbox; she accepts; it becomes a scheduled listing on her calendar; eater is notified.

**M3 demo:** "Eater follows a baker. Baker schedules. Eater is notified. Or: eater posts a bounty. Baker accepts. Bounty becomes a scheduled bake on her calendar. Saturday rolls around — auto-claim fires."

---

## M4 — The mock veneer

Per `01-product-design.md` §7: anything a normal user would interact with gets a real UI; the integration underneath is fake. M4 is the layer that turns a working marketplace into something that *looks* like a real product end-to-end.

### E11 — Mocked payments + payouts + tax

- **Goal:** every money-related screen looks real; no money moves.
- **Scope (in):**
  - Stripe-style checkout flow on claim: card form, "processing," success page. Always succeeds. Stores a fake `payment_intent` ID.
  - Bounty deposits: fake-held on post, fake-released on fulfillment.
  - Baker earnings dashboard: real ledger of mocked transactions; "Payout" button triggers a fake bank-transfer flow.
  - Year-end tax PDF: generated from the (mock) earnings ledger; numbers are *internally* consistent.
  - Bank-account form for bakers: real UI, fake validation.
- **Scope (out):** any actual payment processor integration; KYC (mocked in E12).
- **Dependencies:** E4, E8, E10.
- **Workflows covered:** payment surfaces of W11, W12, plus the earnings half of W4/W8.
- **Done when:** a full economic cycle (claim → pay → baker-earns → baker-payouts → year-end PDF) renders end-to-end with consistent numbers.

### E12 — Mocked verification + delivery

- **Goal:** the two other "real-product" surfaces from §7 that aren't payments.
- **Scope (in):**
  - Baker identity verification flow (W1 cont.): real document-upload UI, "Reviewing your documents..." state, auto-approve after configurable delay.
  - Delivery option on listings: pickup is default; toggle "offer delivery" exposes a fake-courier-assignment flow on claim, fake ETA, fake driver-tracking screen.
- **Scope (out):** real KYC; real couriers; insurance disclosure UI beyond the existing cottage-food disclaimer.
- **Dependencies:** E2, E4.
- **Workflows covered:** verification half of W1, delivery overlay on W11/W14.
- **Done when:** a baker uploads a "license"; sees "approved" within the configured delay; can offer delivery on a listing; an eater can choose delivery and see the fake courier flow.

### E13 — Operator console

- **Goal:** the third role in the product. Moderation queue, verification review (real on our side, even if the underlying KYC is mocked), system dashboard.
- **Scope (in):**
  - `/operator` (gated by `canOperate`): reports queue, suspended users, baker verification submissions.
  - Suspend/unsuspend actions; flag/unflag listings; resolve disputes (status flow only).
  - Live dashboard: counts of users, listings, claims today; abuse signals (rate-limit hits, report counts).
- **Scope (out):** ML-driven abuse detection; SLA tooling.
- **Dependencies:** E12.
- **Workflows covered:** W17, W18.
- **Done when:** an operator can suspend a user, resolve a report, and approve a verification — all from one console.

**M4 demo:** "Three full surfaces (eater, baker, operator). Money looks real. Delivery looks real. Verification looks real. None of it actually moves a dollar or a courier — and the §7 line is honest about which is which."

---

## M5 — The moat + polish

### E14 — Demand insights (the named moat)

- **Goal:** turn the side-hustle baker into a pro baker, per the product doc's own framing. The first epic that depends on having real-ish data, which is why it's last.
- **Scope (in):**
  - Per-baker dashboard (W6) answering:
    - What bread types are people *searching* for in my area, and when?
    - What ready-by time slots have unmet demand?
    - Which of my listings sold out fastest? Which sat?
    - What open bounties match my kitchen?
  - Logging: search queries, bounty postings, listing impressions, claim latency. Stored aggregated.
  - Geographic + temporal aggregations; baker sees only their area.
- **Scope (out):** baker-facing pricing recommendations (could come later); ML.
- **Dependencies:** E3, E5, E10 (need real bounty + search history); ideally seeded with synthetic activity for demo purposes.
- **Workflows covered:** W6.
- **Done when:** a baker visits `/baker/insights` and sees four real charts derived from real (or seeded-real) traffic.

### E15 — Real-time + cross-cutting polish

- **Goal:** the feed feels alive, not snapshot-y. Plus the cross-cutting things that don't fit cleanly into a feature epic.
- **Scope (in):**
  - SSE (Server-Sent Events) channel per geographic cell; new/claimed/cancelled listings push to subscribed clients.
  - Eater home (all four variants) and baker today auto-update without refresh.
  - Map view as a peer to list across all relevant pages (list + map sync).
  - Photo-required enforcement at post-time.
  - Search/filter narrow-on-purpose audit: confirm we still have only {tags, distance, ready-by, price, baker} — no filter sprawl.
  - Notification center polish.
- **Scope (out):** WebSocket upgrade (defer until SSE stops scaling); native mobile.
- **Dependencies:** E5, E8, E13.
- **Workflows covered:** real-time aspect of W4, W9, W10; geographic aspect cross-cutting.
- **Done when:** opening two browser windows side-by-side — post a loaf in one, see it appear in the other within ~2s, no refresh.

**M5 demo:** "Bakers see demand they never had visibility into before. Two windows side-by-side: post a loaf, watch it appear. Map view everywhere. The product feels alive."

---

## Cross-cutting concerns (every epic, not their own)

- **Tag system as one mechanism.** No epic adds a parallel matcher / filter / classifier. If you find yourself building a second one, stop and use tags.
- **Tests on the W3 → W11 → W14 golden path.** Playwright keeps it green from M1 forward.
- **Mock-vs-document discipline (`01-product-design.md` §7).** New work classifies into one or the other in its PR description.
- **Privacy gradient.** Pre-claim views fuzz address; post-claim reveal. Audited in any epic that adds a new view.
- **Real-time additivity.** E15 retrofits real-time onto existing pages — earlier epics should expose state through props/server-actions in shapes that can be subscribed to without rewrites.
- **Universal laws.** Variability lives in data; one source of truth per concept; one-way deps; tests assert behavior; etc. Cited (`// [LAW:<token>]`) when load-bearing.

---

## What this plan deliberately doesn't decide

- Native mobile (web-only for now; PWA possible later).
- Internationalization beyond the cosmetic region picker noted in `01-product-design.md` §7.
- Pricing model for Breadly itself (take rate? subscription? listing fee?). Mocked at E11; a real answer is a future business question.
- Specific rollout cities for the real-business read. The portfolio read doesn't need this; the real-business read decides it after running the feed-shape test from `compass/`.

---

## Demo-Ready Cut (post-M0, investor-shaped)

The M0–M5 plan above is the engineering decomposition. The five epics below are the *demo-shaped* rollups: each one is a coherent thing an investor can be walked through in 2–3 minutes, and each is the gate to the next. They reference the slice-epics above rather than duplicating their scope — when ED1 says "rolls up E3 + E7 + E8," that means those slice-epics are the work, and ED1 is the integration + polish that turns a working slice into a demoable surface.

Sequencing is `ED4 → (ED1 ∥ ED2) → ED5 → ED3`. ED4 (dev-tools) ships first because every demo of ED1/ED2/ED3 depends on being able to seed a representative state in seconds. ED5 (real map) lands after the workflows are real, so map pins point at real listings. ED3 (admin) lands last because it's the lowest-traffic surface and depends on having real users + listings + reports to moderate.

### ED4 — Dev-tools panel (seeded reality on demand)

- **Goal:** any demo state is a one-click load. Seed packs, time-travel, user impersonation, DB reset — all behind a gated `/dev-tools` route. This is the **prerequisite** for demoing anything else convincingly: an investor walkthrough can't survive a "let me just create five bakers and twelve listings real quick."
- **Scope (in):**
  - `/dev-tools` route, gated by env (dev/staging only) **and** a `canDev` capability flag on `users` (so prod-deployed dev builds don't accidentally expose it). Server-side guard, not just UI hide. [LAW:single-enforcer]
  - **Seed packs:** named, idempotent, parameterized — `pack:weekend-morning` (30 bakers, ~100 active listings, ~20 in-progress claims, mid-Saturday timestamp), `pack:sparse-tuesday` (5 bakers, sparse listings, surfaces empty-state UI), `pack:bounty-pressure` (heavy demand, light supply — exercises ED2 reverse channel), `pack:reset` (wipe to E1 baseline + Boulder bakers). One file per pack under `web/src/db/seed-packs/`.
  - **Time-travel:** a single `system_clock` row in DB; all server code reads `now()` through one helper; dev-tools can set it forward/back. Lets us materialize tomorrow's scheduled bakes today for a demo. [LAW:one-source-of-truth]
  - **Impersonation:** dev can jump into any seeded user's session (signed audit log row written every time). Critical for showing baker → eater handoff in a single demo without juggling two browsers.
  - **DB inspector:** read-only table list + row counts + last-mutation timestamps. Catches "the demo broke because seed didn't run."
  - **Reset confirms:** any destructive action requires a typed-in pack name, not a single click.
- **Scope (out):** writing to prod (panel is hard-disabled there); a generic schema-edit UI; replay/recording.
- **Dependencies:** E1 (schema + initial seed exist).
- **Workflows covered:** none directly — unblocks reliable demos of every other workflow.
- **Done when:**
  1. From a freshly-deployed dev environment, loading `pack:weekend-morning` produces the same exact state every time, in <5s.
  2. Time-traveling +24h causes scheduled bakes to materialize as `ready` listings without code changes.
  3. Impersonating a baker, posting a loaf, then impersonating an eater and claiming it works in a single browser, in <60s.
  4. The panel returns 404 in production builds.

### ED1 — Full baker workflow (post → schedule → run a day → storefront → ratings)

- **Goal:** a baker can be onboarded, run a full week of bakes (recurring schedule + one-offs), execute a Saturday morning of handoffs from one screen, and have a public storefront URL that looks credible when pasted into Instagram.
- **Rolls up:** E2 (baker capability) · E3 (post-a-loaf, tags) · E4 (handoff side) · E6 (storefront) · E7 (schedule + recurring) · E8 (today screen + ratings).
- **Demo path:** sign up → claim baker → set slug + bio + address → post one-off loaf (<30s) → set up recurring Tue+Fri schedule → time-travel to Saturday → today screen shows two ready listings + one claimed → mark handoff → rate the eater → check `/b/<slug>` from a logged-out browser.
- **Scope (in):** all the slice-epic scopes above, *integrated*: shared nav, consistent empty states, a single onboarding flow that walks a new baker from sign-up to first listing in <2 minutes. Photo upload via signed URLs to `breadly-{env}-uploads` (already in IaC).
- **Scope (out):** payouts (ED-future / E11); identity verification UI (E12); demand insights (E14); subscriptions (handled in ED2's "follow" subset).
- **Dependencies:** ED4 (need seedable state to develop against), E2 mostly done.
- **Done when:** the demo path above runs end-to-end in a single browser session against a freshly-seeded `pack:weekend-morning`, with no refresh hacks, in under 4 minutes wall-clock.

### ED2 — Full bread-seeker workflow (find → claim → pick up → rate → follow)

- **Goal:** an eater can sign up, set a neighborhood + preferences, find loaves they want via the home feed (variant A, real DB), see fuzzy locations pre-claim and exact addresses post-claim, claim, walk through a pickup code handoff, rate the baker, follow them, and receive a notification the next time that baker schedules a bake.
- **Rolls up:** E2 (eater identity) · E3 (listing detail) · E4 (claim/handoff eater side) · E5 (home feed, variant A as default) · E9 (follow + notifications, subset: follow-baker only — tag-set follows + bounties move to a later cut).
- **Demo path:** sign up → enter neighborhood (Newlands) → home feed shows nearby loaves with fuzzed pins → pick a country sourdough → claim → pickup code + exact address revealed → handoff (paired with ED1 baker side) → rate baker → follow → time-travel to next scheduled bake → in-app notification + email arrives.
- **Scope (in):** integrated nav with capability-aware affordances (already started in `Header.tsx`), preference editor (W16), email notifications via Resend.
- **Scope (out):** bounties (E10 / future cut); subscriptions/auto-claim (E9 subset); web push.
- **Dependencies:** ED4, ED1 (so a real baker exists to find/claim/follow).
- **Done when:** the demo path above runs end-to-end against the same seed pack ED1 uses, and the follow→schedule→notify loop fires within ~30s of the scheduled bake materializing.

### ED5 — Real, live, working map

- **Goal:** replace `FakeMap` in variant A and any future map surface with a real MapLibre GL map tiled from our own Cloud Storage bucket, showing real lat/lng pins driven by PostGIS radius queries, with the privacy gradient enforced on pin coordinates server-side. This is also the first map that lands in `/baker/today` (where listings are baking) and `/b/<slug>` (storefront kitchen pin).
- **Scope (in):**
  - **Tiles:** Protomaps `.pmtiles` for the Boulder bounding box, uploaded to the existing `breadly-dev-tiles` / `breadly-prod-tiles` buckets (E1 IaC already created them — they're empty). Pre-publish step in `infra/` README; tile build script under `web/scripts/build-tiles.sh`.
  - **Map component:** one `<Map>` React component used by all map surfaces. Props: pins (with discriminated `state` for color), bounds, center, onPinClick. No callsite reaches into MapLibre directly. [LAW:single-enforcer, LAW:locality-or-seam]
  - **Privacy at the data layer, not the view:** server-side `getNearbyListingsForMap()` returns *already-fuzzed* coordinates for unclaimed listings (deterministic ~200m jitter seeded by listing id, so the pin doesn't dance between page loads), and exact coordinates only for the claimer of a listing. The client never receives the exact lat/lng for a loaf it hasn't claimed. [LAW:single-enforcer for privacy]
  - **List+map sync** in variant A: hovering a card highlights its pin and vice-versa. Selecting a pin scrolls its card into view.
  - **Geolocation consent:** "Use my location" button → browser prompt → centers map; otherwise default to neighborhood centroid.
  - **Pan/zoom limits:** locked to ~Boulder metro to prevent wandering off the tiled area.
- **Scope (out):** routing/directions (deep-link to Google/Apple Maps for now); heatmaps (defer to E14 demand insights); custom map style beyond Protomaps default.
- **Dependencies:** E1 (buckets exist), ED4 (seeded data with real lat/lng), ED2 (privacy gradient kicks in on claim).
- **Done when:**
  1. Variant A renders a real Boulder map with pins matching the listings shown in the cards on its right.
  2. Hovering a card highlights its pin; clicking a pin scrolls the card into view.
  3. Inspecting the network response for an unclaimed listing shows fuzzed coordinates only.
  4. After claim, the listing-detail page reveals the exact address + a map centered on it.
  5. Tiles served from our own bucket (no Mapbox/MapTiler tokens in the bundle).

### ED3 — Admin / operator panel

- **Goal:** the third role surface — an operator can moderate users + listings, review verification submissions, resolve reports, and watch system health from one console.
- **Rolls up:** E13 (operator console) + adds the system-health + audit-log pieces beyond E13's original scope, since by the time we ship this we'll have ED1/ED2 data to moderate.
- **Scope (in):**
  - `/admin` route, gated by `canOperate`. (Distinct from `/dev-tools` — dev-tools mutates seeded reality; admin acts on real production state.)
  - **Reports queue:** flagged listings, reported users, dispute claims (no-show on either side). Each row → detail view with full context + action buttons (suspend, take-down, resolve).
  - **Verification review:** pending baker verifications from E12 (mocked-pipeline OK, real moderator action). Approve / request-more / reject.
  - **User search + actions:** find user by email/slug, view their listings/claims/ratings, suspend or unsuspend (status flow only).
  - **System health:** counts of users / active listings / claims today / handoffs / no-show rate / report rate, with deltas vs yesterday. Powered by aggregate queries, not a separate analytics store.
  - **Audit log:** every admin action writes a row (`actor`, `target_type`, `target_id`, `action`, `reason`, `at`). Visible in-panel and queryable by support.
- **Scope (out):** ML-driven abuse detection; SLA timers; ticketing system; bulk operations.
- **Dependencies:** E12 (verification flow exists, even if KYC is mocked), ED1 + ED2 (so there are real users + listings to moderate), ED4 (so we can seed an "admin needs to review 3 reports + 2 verifications + 1 dispute" demo state).
- **Done when:** an operator, starting from `/admin` against `pack:admin-loaded`, can suspend a user, take down a listing, approve a verification, and resolve a dispute — and every action shows up in the audit log within the same session.

### Demo-cut sequencing summary

| Order | Epic | Why now |
|---|---|---|
| 1 | ED4 dev-tools | Every other demo's reliability depends on it |
| 2a | ED1 baker workflow | Either order works; build in parallel |
| 2b | ED2 eater workflow | Either order works; build in parallel |
| 3 | ED5 real map | Both workflows now produce real lat/lng to plot |
| 4 | ED3 admin panel | Lowest-traffic surface; needs real data to moderate |

The five-epic cut deliberately defers payments (E11), bounties (E10), demand insights (E14), and real-time SSE (E15) — all of those are *additive* veneer/moat work that lands cleanly on top of ED1–ED5 once the core surfaces are real. None of them is on the investor-demo critical path.

---

## Still Fuzzy

- **When does the feed-shape test run?** The four variants are live but untested. We default to A in M1; if testing happens between M1 and M2, results inform M2/M3 scope. If testing slips, A stays as default.
- **Whether E14 (demand insights) is ahead of its skis.** It's listed last because it needs traffic to be real. For a portfolio demo it can be seeded — but seeded insights are less compelling than real ones, and we should be honest about which we're showing.
- **PostGIS vs. cube/earthdistance.** Real geo radius matters for the supply-density crux. PostGIS is the right answer for production; for portfolio it may be over-equipment. Decide at E1.
