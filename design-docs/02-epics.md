# Breadly — Epic Plan

Engineering decomposition of `01-product-design.md` into shippable epics, sequenced so each milestone is a coherent demoable cut. Lives alongside the product design doc, not above it — when the product doc and this doc disagree, the product doc wins and this doc gets revised.

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

Total: 15 epics across 5 milestones. Each milestone ends with a working demo.

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
  - Email + Google OAuth via Auth.js.
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

## Still Fuzzy

- **When does the feed-shape test run?** The four variants are live but untested. We default to A in M1; if testing happens between M1 and M2, results inform M2/M3 scope. If testing slips, A stays as default.
- **Whether E14 (demand insights) is ahead of its skis.** It's listed last because it needs traffic to be real. For a portfolio demo it can be seeded — but seeded insights are less compelling than real ones, and we should be honest about which we're showing.
- **PostGIS vs. cube/earthdistance.** Real geo radius matters for the supply-density crux. PostGIS is the right answer for production; for portfolio it may be over-equipment. Decide at E1.
