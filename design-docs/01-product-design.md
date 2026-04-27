# Breadly — Product Design Proposal

> *"A marketplace for time-bound artisan bread, where bakers plan around demand and eaters reserve the loaf they want."*

This document is a **product-level** design — personas, workflows, pages, and core mechanics. No technical architecture yet. Scope is a portfolio-grade end-to-end application: it must really work, but does not need to handle real money, real food-safety law, or real scale.

---

## 1. The Core Insight (Revised)

The earlier framing — "a hot loaf is coming out of the oven, connect it to a mouth" — is good marketing copy and a real edge case, but it's not how this market actually behaves. Modeling the product around it would be like building Uber assuming everyone is a casual driver giving a ride on the way to work.

**What actually happens:**
- Most bakers will operate semi-professionally. They bake on a schedule, plan inventory around expected demand, and want to grow a recognizable storefront.
- Most eaters will plan a few hours to a few days ahead — "I want a sourdough boule for Saturday brunch" — and value reliability more than spontaneity.
- The casual "loaf just came out, who wants it" flow is real and important — it's the cold-start magic and the long-tail of supply — but it lives *alongside* the planned flow, not as the whole product.

**The actual product is a two-sided marketplace with three things on top of any normal marketplace:**

1. **Time-bound supply.** A loaf has a "ready" moment and an age that grows from there. Age is one signal among many.
2. **Both-sides planning.** Bakers schedule supply forward; eaters reserve forward. Both sides also support spontaneous activity.
3. **A reverse channel.** Eaters can post **bread bounties** — "I'd pay $X for a miche by Friday" — and bakers fulfill them. This is the demand-side equivalent of listing.

The right Uber analogy: **Breadly serves the full spectrum from casual one-off baker to full-time artisan**, and the product must not punish either end.

**What actually drives a purchase decision** is a blend of factors that the eater weighs themselves: bread *type* (do I want what they're selling?), *baker* (do I trust them, have I had their bread before?), *distance*, *price*, *allergen fit*, and *age* of the loaf. Someone will happily pick up a day-old loaf of exactly what they want from a baker they love over a fresher loaf of something they don't. The product surfaces these factors honestly and lets the eater rank them; it does not pretend to know the right weighting.

---

## 2. Personas

### 2.1 Bakers — a spectrum, not a type

| | **Casual** | **Side-hustle** | **Pro / Storefront** |
|---|---|---|---|
| Frequency | Bakes for self, occasional surplus | Weekly scheduled bakes | Daily / multiple bakes per day |
| Inventory model | Reactive ("I have an extra") | Planned weekly menu | Full schedule, recurring SKUs |
| Tools needed | One-tap "post this loaf" | Schedule + storefront | Schedule + demand insights + bounty inbox + analytics |
| What they want | Don't waste the loaf, meet a neighbor | Predictable side income | Grow recognizable brand, fill capacity |

The product must support all three without forcing the casual baker to feel like they're running a business, and without limiting the pro baker to casual tools. **A baker should be able to grow up the spectrum without changing apps.**

### 2.2 Eaters — also a spectrum

| | **Spontaneous** | **Planner** | **Loyalist** |
|---|---|---|---|
| Trigger | Hungry now, walking past | Hosting brunch Saturday | Has favorite bakers, weekly habit |
| Behavior | Browses map, claims something live | Reserves 1–3 days out, posts bounties | Subscribes / follows, gets notified |
| What they want | Best fresh thing nearby right now | A specific bread by a specific time | The bakers they trust, on autopilot |

Cutting across all three: **eaters have preferences**, and the system treats every preference the same way — as a tag-based filter. "Gluten-free," "sourdough only," "no rye," "nut-free kitchen," "vegan" are mechanically identical: bakers tag their listings, eaters tag what they want or don't want, the feed filters accordingly. There is no special "allergens" subsystem — allergens are just preferences that the eater takes more seriously. (We surface them with a clear disclaimer that the platform doesn't verify tags.)

### 2.3 Operator (us)
Moderation, dispute resolution, baker verification review, demand-data oversight.

---

## 3. The Loaf Lifecycle

A loaf is a single object that moves through a small number of states. The lifecycle starts before the oven — scheduled loaves are first-class inventory that eaters can reserve.

The states are simple and operational:

- **Scheduled** — baker has put it on the calendar with an expected ready time.
- **Ready** — the baker has marked it out of the oven and pickup-available. The loaf has an `out_of_oven_at` timestamp from this point on.
- **Claimed / Picked up / Cancelled** — terminal outcomes.

That's it. We don't predict freshness, define "peak" windows, or pretend to know when bread crosses some quality threshold. **We show the eater the bake time and let them decide.** A listing displays "out of the oven 3h ago" the same way a used-goods marketplace shows mileage — it's an honest data point, not a verdict.

Listings are auto-hidden after a baker-configurable cutoff (default ~24h) so stale items don't clutter feeds, but the cutoff is a baker-set policy, not a quality claim.

---

## 4. Core Workflows

### Baker workflows

#### W1 — Onboard
Sign up, choose baker profile, set address, acknowledge cottage-food disclaimer (mocked verification), create initial storefront (name, photo, bio, default pickup window). **Success:** "downloaded" → "first item on calendar" in under 10 minutes.

#### W2 — Build a schedule
Baker creates recurring or one-off planned bakes: "Country sourdough, every Tuesday + Friday, 6am, 8 loaves." Schedule is the spine of the pro/side-hustle baker's day. The casual baker can skip this entirely and use W3 only.

#### W3 — Post a spontaneous loaf
The original "hot loaf" flow. One tap: "I have something out of the oven now." Confirm type, quantity, price, photo. Live in seconds. This is the long-tail and the cold-start.

#### W4 — Manage today
Live dashboard: what's planned today, what's claimed, who's coming when, pickup codes. Mark handoffs, mark no-shows, pull a listing if something went wrong.

#### W5 — Storefront
Public page at `/b/<baker-slug>`. Shows: bio, photos, current schedule (next 7 days), live listings, ratings, follower count, specialties, kitchen tags ("nut-free kitchen," "dairy-free," etc.). The shareable URL — what the baker pastes into Instagram and texts to friends.

#### W6 — Demand insights
Baker sees a dashboard answering questions they actually ask:
- What bread types are people searching for in my area, and when?
- What time slots have unmet demand?
- Which of my listings sold out fastest? Which sat?
- What bounties are open near me right now that I could fulfill?

This is what makes a side-hustle baker into a pro baker. **It is the closest thing this product has to a moat.**

#### W7 — Fulfill a bounty
Baker sees an open bounty matching their kitchen ("rye boule, by Saturday, within 3 mi, $18"), accepts it, schedules the bake, eater is notified. Bounty becomes a confirmed planned listing tied to that eater.

#### W8 — Receive feedback
After each handoff, baker gets the eater's rating + (optional) written feedback. Baker can respond. Aggregate ratings + recent reviews appear on storefront.

### Eater workflows

#### W9 — Discover (now)
Open the app → split-view map + list of available loaves nearby. Default sort is a sensible blend (distance, age, baker rating, preference match) but the eater can re-sort by any single factor with one tap. Filterable by tags (bread type, dietary, ingredient), distance, price, ready-by-time, baker. The "what's good near me right now" flow.

#### W10 — Discover (planned)
Switch the same view to "ready by" a future time — "show me everything I can pick up Saturday morning." Browses the *forward* inventory. Critical for the planner persona.

#### W11 — Claim / reserve
Tap loaf → see baker, neighborhood, bake time / ready time, tags (ingredients, dietary, style), ratings. Confirm. Get pickup code, exact address, directions. Payment is mocked (see §7).

#### W12 — Post a bounty
"I want a gluten-free sourdough by Friday, willing to pay $15, within 5 mi of me." Bounty is broadcast to matching bakers. Bakers can accept, counter-offer, or ignore. If accepted, becomes a planned listing.

#### W13 — Follow & subscribe
Follow a baker (notified when they post or schedule), follow a bread type ("any rye within 2 mi"), or subscribe to a recurring purchase ("the Tuesday country loaf, every week, until I cancel"). Subscriptions auto-claim when the baker confirms the bake.

#### W14 — Handoff
Eater arrives at baker's address. Pickup code shown by one party, tapped by the other. Both sides see it close.

#### W15 — Rate
Short prompt: thumbs + optional comment + tags ("crust was perfect," "smaller than I expected"). Feeds reputation and demand insights.

#### W16 — Manage preferences
Eater profile holds preference tags as include / exclude lists ("only sourdough," "no rye," "must be gluten-free," "nut-free kitchen only"). All preferences use the same mechanism — there is no separate "allergens" subsystem. Excludes hide listings by default with a one-tap "show anyway." Preference editor is easy to find, sticky, and visible from any feed via a filter chip.

### Operator workflows

#### W17 — Moderate
Reports queue (bad listing, no-show, dispute), suspension tools, baker verification review, bounty abuse review.

#### W18 — System health
Live counts, recent activity, basic abuse signals. Minimal but real.

---

## 5. Pages / Screens

### Public / unauthenticated
- **Landing** — value prop + live map of nearby active bakers + bread types currently being baked.
- **Auth** — sign up / log in. Role chosen at signup (eater / baker / both). Switching later allowed.
- **Public baker storefront** — `/b/<slug>` — bio, schedule, live listings, ratings. Indexable, shareable.
- **Public bounty board** — `/bounties` — open eater bounties in your area (browseable by anyone, claimable by bakers).

### Eater app
- **Eater Home (Now)** — split-view map + sorted list of currently-available loaves. Map and list stay in sync (tapping a pin highlights the row, and vice versa).
- **Eater Home (Planned)** — same split-view but for a future "ready by" time window.
- **Loaf detail** — photo, baker, bake/ready time, tags, price, claim.
- **Claim flow** — confirm → pickup code + address + directions + map route.
- **Bounty composer** — describe what you want, when, where, price.
- **My bounties** — open / accepted / fulfilled.
- **My claims & subscriptions** — active, upcoming, past; manage recurring.
- **Discover / Follows** — followed bakers, saved searches, notification settings.
- **Preferences** — include / exclude tag editor (covers dietary, style, ingredient).
- **Eater profile** — history, ratings given/received, settings.

### Baker app
- **Baker Today** — primary screen: live + scheduled today, claimed seats, handoffs pending.
- **Schedule** — calendar of planned bakes; create recurring or one-off.
- **Post-a-loaf** — spontaneous-loaf hot path (W3).
- **Storefront editor** — manage public storefront content.
- **Demand insights** — dashboard of search/bounty/sellout data for your area & specialties.
- **Bounty inbox** — open bounties matching your kitchen; accept / counter / dismiss.
- **Claim list / inbox** — all incoming claims with eater, ETA, code.
- **History & ratings** — past bakes, earnings (mocked), reviews.

### Operator
- **Moderation queue** — reports, flagged listings, disputes.
- **Verification review** — baker onboarding submissions.
- **System dashboard** — live activity, basic health.

### Cross-cutting
- **Notifications center**.
- **Settings** — account, address, payout (stub), notifications.

---

## 6. Cross-cutting mechanics

- **Geography is core.** Every loaf, bounty, and search has location. Default radius configurable per user.
- **Map view is a peer to the list view**, not an alternate. Eater Home, Planned, and the bounty board all show map + list side-by-side (or stacked on small screens), with selection and filters synchronized between them.
- **Privacy gradient.** Baker's exact address is hidden until claim. Pre-claim view shows neighborhood + distance and a fuzzed pin.
- **Real-time feed.** Eater Home updates as listings appear, get claimed, change state.
- **Notifications are the engagement engine.** "A gluten-free sourdough you'd love is scheduled for Saturday 0.4 mi away" is the moment of magic.
- **Tag-based matching** is a single mechanism. Listings have tags; eaters have include/exclude tag preferences; bounties have required tags. The same matching code serves "filter the feed," "notify on match," and "match bounties to bakers."
- **Reputation is two-sided.** Bakers and eaters both have ratings. Eater rating affects bounty visibility (bakers won't fulfill flaky strangers).
- **Search/filter is narrow on purpose:** tags, distance, ready-by, price, baker. No filter sprawl.
- **Photos required at post time.** Real loaf, not stock.

---

## 7. Explicitly out of scope (and why)

These are real-world concerns a real business **must** solve. We apply a single rule:

> **If a normal user (baker or eater) would interact with it, we MOCK it — the UI is real, the underlying integration is fake.**
> **If a normal user would not interact with it (legal/compliance/back-office concerns), we DOCUMENT it in `02-real-world-gaps.md` and skip it in code.**

### Mocked (user-facing)
| Concern | Mock strategy |
|---|---|
| **Payments** | Stripe-style flow with a fake gateway that always succeeds. Data model + screens look real; no money moves. Bounty deposits are fake-held, fake-released. |
| **Payouts to bakers** | Fake payout dashboard + fake bank-account form. Earnings ledger is real; the wire transfer is not. |
| **Tax docs (1099s, year-end summaries)** | Generate a real-looking PDF/HTML statement from the (mock) earnings ledger. Numbers are correct relative to the mocked transactions. |
| **Delivery / couriers** | Pickup is the default. A "delivery" option exists with a fake courier-assignment flow, fake ETA, and a faked driver-tracking screen. |
| **Multi-region / i18n** | Region picker exists in settings (changes labels, currency symbol, units). Underlying data is single-locale; the toggle is cosmetic but visible end-to-end. |
| **Identity verification (baker side)** | Real "Verify your identity" flow with document-upload UI; the verification result is mocked (auto-approve after a delay). |
| **Disputes (user-facing pieces)** | Eater/baker can file a dispute, see its status, and message the operator. Resolution is real on our side but doesn't escalate anywhere. |

### Documented only (back-office / legal / compliance)
| Concern | Why document only |
|---|---|
| **Cottage food laws / food safety** | Jurisdictional patchwork. No user UI affordance beyond a disclaimer at signup. |
| **Insurance / liability** | Pure business / legal concern. No user surface. |
| **KYC / AML** | Implementation details behind the verification UI; the user only sees "verify your identity," which is mocked above. |
| **Background checks for bakers** | Same as KYC. |
| **Fraud / abuse at scale (ML, risk scoring)** | A simple report button + rate-limiting is implemented; the heavy machinery isn't. |
| **Scale (millions/day)** | Architectural choice, not a user surface. Document the bottlenecks. |
| **Dispute resolution at scale (SLAs, regulation)** | The user-facing dispute flow is mocked; the back-office machinery for handling them at volume is not. |

A companion doc — `02-real-world-gaps.md` — expands each row into "what a real launch would require." (To be written next, on request.)

---

## 8. What this doc deliberately doesn't decide

- Tech stack, hosting, framework choices, database, auth provider.
- Data model and API shape.
- Native vs. web vs. PWA.
- Brand / visual design beyond "storefronts and listings need to look polished and trustworthy."
- Pricing model for Breadly itself (take rate, subscription, listing fee).

---

## 9. Proposed next steps

1. **Confirm or revise** the persona spectrum, the lifecycle model, the bounty mechanic, and the demand-insights workflow.
2. Decide which **out-of-scope** items (§7) you want to actually build, mock, or document.
3. Move to **technical design**: stack, data model, real-time strategy, deployment.
4. Build plan with milestones tied to demoable workflows (W1 → W18).
