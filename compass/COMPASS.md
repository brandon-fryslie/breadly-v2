# Breadly — Compass

A growing log of PM thinking on Breadly's True North. Each entry is one increment.

## Contents
- [2026-04-27 — Diagnose the crux (light)](#2026-04-27--diagnose-the-crux-light)
- [2026-04-27 — Diagnose the crux, rev. 2 (light)](#2026-04-27--diagnose-the-crux-rev-2-light)
- [2026-04-27 — Standing decision: straddle portfolio + real-business](#2026-04-27--standing-decision-straddle-portfolio--real-business)
- [2026-04-27 — Four feed-shape mockups + user-test plan (light)](#2026-04-27--four-feed-shape-mockups--user-test-plan-light)

---

## 2026-04-27 — Diagnose the crux (light)

**Move:** Diagnose the crux (Move 3)
**Depth:** Light. The project has a substantial product-design doc but no committed answer to "what's actually hard here." Diagnosis is sharpening work — light is correct; heavy would be padding.
**Source read:** `design-docs/01-product-design.md`.

### The challenge, in one sentence

**Breadly's hard problem is not building a marketplace UI; it is that the obvious alternative — "text the bakery, or walk in" — is already excellent for the planned case, and "Instagram + DM" is already excellent for the casual case, so Breadly has to be meaningfully better than *nothing* on the eater's most-frequent path before any marketplace mechanics matter.**

### Why this is hard

The eater's status quo is not a competitor product — it's *no product*. In every other marketplace (Uber, DoorDash, Airbnb), the alternative was painful (calling a cab dispatcher, ordering from a paper menu, hotel pricing). For local bread, the alternative is "I already know two bakeries within 10 minutes of me, I follow one on Instagram, and I bought bread an hour ago without thinking about it." This means *discovery* — the part Breadly leans on hardest — has to clear an unusually high bar before a single transaction happens. The bounty mechanic and demand insights, which the doc identifies as the moat, only matter *after* the eater is already a regular user. Cold-start happens at the eater, not the baker. (Inferred from the doc's framing — needs validation.)

### What gets unlocked if we crack it

If Breadly gives an eater a *better-than-status-quo* moment on the first session — typically "a thing I genuinely wanted, that I didn't know existed, that I can have today" — every other system in the doc starts pulling its weight: the planned-discover view becomes the natural second visit, the bounty mechanic becomes the natural third, follows + subscriptions become the retention loop. Without that first moment, those features are scaffolding for a building no one enters. Cracking the eater's first-session magic is also what makes baker-side demand insights (the doc's named moat) actually *have data* — insights are derived from eater behavior, so an eater funnel that doesn't activate produces an insights dashboard with nothing in it.

### What happens if we don't address it

For the portfolio framing (per the doc's stated scope: "must really work, but does not need to handle real money/scale"), the cost of not addressing this is that the demo has no climax. A reviewer clicks through 18 polished workflows and walks away saying "neat marketplace" — which is the same thing they'd say about a shopify template. For a real-business framing, the cost is harsher: the product launches in a city, gets ~50 listings, gets ~5 transactions, and dies — not because the marketplace is broken but because it never beat "I'll just go to the bakery." This is the standard local-marketplace failure mode and it is the project's most likely death.

### The diagnosis implicates something the doc avoids

The doc treats all 18 workflows as roughly co-equal load-bearing surfaces. The diagnosis above says they are not. **W9 (Discover-now) and W11 (Claim) carry the entire weight of the cold-start.** Everything else is post-activation infrastructure. If the doc's design budget is implicitly equal across all workflows, that budget is misallocated — W9/W11 deserve a disproportionate share of the polish, the surprise, the "this feels different" moments. The bounty mechanic, which is the doc's most novel idea, almost certainly cannot earn its keep on a first session and should probably be deprioritized in the demo path even though it's the most intellectually exciting feature.

### Still Fuzzy

- **What is the actual first-session magic moment?** The diagnosis says one is required but doesn't name it. Candidates: (a) "a bread type you've been wanting that's coming out of an oven you didn't know about," (b) "your favorite bakery's full schedule for the next 7 days, which they've never published anywhere," (c) "a bounty board that lets you describe and price what you actually want." Each implies a different product center of gravity, and the doc currently includes all three without ranking. This is the next move — likely Set-guiding-policy or Map-opportunities — once the user reacts to this diagnosis.
- **Whether the portfolio framing or the real-business framing should drive the design.** The doc straddles both ("must really work" + "no real money/scale"). A demo-driven design would over-invest in W9/W11 polish; a real-business-driven design would over-invest in supply density in one specific neighborhood. The current doc tries to do both and risks doing neither well.

---

## 2026-04-27 — Diagnose the crux, rev. 2 (light)

**Move:** Diagnose the crux (Move 3), revising the rev. 1 entry above.
**Depth:** Light.
**What changed and why:** Per user — the rev. 1 diagnosis assumed the eater's status quo is already-good ("I know two bakeries nearby, I follow one on Instagram"). User pushed back: that is a coastal-urban assumption. The actual status quo for most Americans is *industrial supermarket bread*, with real artisan bread rare, expensive, and aspirational. Fresh bread itself is the surprise. The crux shifts accordingly.

### The challenge, in one sentence (revised)

**Breadly's hard problem is that the delight of fresh artisan bread is real and underexposed in most of the US — but for any given eater on any given day, there has to be *something fresh within their reach right now*, and that requires enough local bakers active enough that the feed is never empty. Supply density, not eater discovery, is the gating crux.**

### Why this is hard (revised)

The product's magic is "open the app and there's a sourdough boule three blocks away that came out of an oven 40 minutes ago." That magic dies instantly if the answer is "nothing nearby today, check back tomorrow." Local bakery counts are low almost everywhere outside a few cities, and home/cottage bakers — the long tail Breadly is uniquely positioned to unlock — bake intermittently and unpredictably. So Breadly has to convert intermittent, scattered, hobbyist supply into *something that looks reliably full* to a first-time eater. This is a different kind of cold-start problem than Uber's: Uber needed enough drivers in a city; Breadly needs enough bakers in a *neighborhood*, on the day someone happens to open the app, with something that matches what that person actually wants. The radius is small and the SKUs are heterogeneous.

### What gets unlocked if we crack it (revised)

If a typical eater opens the app on a typical Saturday and sees three real options within a 10-minute drive, the rest of the doc earns its keep almost mechanically: the bread itself sells the second visit, follows + subscriptions become natural retention, planned-discovery becomes a weekend ritual, and the bounty mechanic finally has a real reason to exist (filling gaps in supply that the feed itself reveals). The demand-insights "moat" the doc names becomes genuinely valuable to bakers because it's derived from a feed that's actually being used. Crucially: this also frees the design from having to invent a clever first-session activation moment — *the bread is the moment*, provided it's actually there.

### What happens if we don't address it (revised)

For the real-business framing: the predictable failure is launching with a thin feed that's empty more often than not, eaters bouncing on first visit and never returning, the casual baker tier (which the doc carefully designs for) never accumulating because there's no demand pulling them in. For the portfolio framing: the demo only works if the demo data is *seeded to look dense*, which is fine for a demo but means the design decisions made under "must really work" are subtly tuned for a fictional density that wouldn't survive contact with reality. Worth being honest with ourselves about which it is.

### What this changes about the doc

- W9 (Discover-now) is still load-bearing, but for a different reason than rev. 1 said. Not because it has to *outshine* a known bakery — because it has to *not be empty*.
- The bounty mechanic (W12) recovers some of its importance: a bounty board is a way to make the feed feel non-empty even when supply is sparse, by showing *latent demand* alongside *current supply*. This is a real argument for the bounty mechanic that the doc's own framing doesn't quite make.
- The casual-baker workflows (W3, the one-tap "I have something out of the oven now") become much more important than rev. 1 implied. They're the cheapest way to thicken a thin neighborhood feed.
- The pro-baker tier and demand insights matter *later* — after density exists. They're not the first move; they're the second.

### Still Fuzzy (revised)

- **When an eater opens the app, what does the screen need to show for them to come back?** Not a per-capita / loaves-per-thousand-residents question — that's fake rigor. The real question is qualitative and product-shaped: is the feed "alive" because there are several options, because there's *one option that's exactly right*, because there's something happening *soon* even if not now, or because tomorrow's schedule is visible and exciting? Each answer implies a different design (more supply vs. better matching vs. more forward-visibility vs. richer scheduled content). The launch strategy follows from this answer — not from a density number.
- **How honest is "fresh artisan bread is underexposed"?** The claim is plausible and matches lived experience in most of the US, but it's also the kind of thing a founder believes too easily. Worth one round of evidence — even informal — before betting the design on it.
- **Demo vs. real launch tension is now sharper.** A demo can fake density. A real launch can't. The design choices that follow this diagnosis differ depending on which Breadly is actually being built. *(Resolved in the next entry — see standing decision below.)*

---

## 2026-04-27 — Standing decision: straddle portfolio + real-business

**Per user, 2026-04-27:** the project deliberately straddles both framings. It is simultaneously (a) a portfolio piece that demonstrates competence end-to-end and (b) a design that takes the real-business case seriously. Neither framing is allowed to silently win.

**What this means in practice:**
- Designs are evaluated against both bars: would this actually work in a real neighborhood, *and* does it demo well in 90 seconds?
- When the two framings would diverge (e.g. supply-density: real launch demands one dense neighborhood; demo can seed any city), call out the divergence in the artifact rather than picking one and quietly losing the other.
- "We don't know which one will win in the end" is a feature, not a bug. The product has to remain coherent under both readings simultaneously.

**Why this is recorded as a standing decision, not a still-fuzzy item:** future PM increments should *not* try to re-resolve this tension. It's resolved — the resolution is "hold both." Increments that propose collapsing to one framing should be treated as drift and pushed back on.

---

## 2026-04-27 — Four feed-shape mockups + user-test plan (light)

**Move:** Map-opportunities (Move 5) + Shape-the-solution (Move 8). Light depth.
**Why both:** the four candidates from rev. 2's still-fuzzy item are the opportunity map; each mockup is a shaped solution sized to the smallest test that disconfirms or confirms its hypothesis. We are not building four products — we are building four screens that each *encode one bet about why an eater comes back*.

**Decision rule for the test:** the winner is the variant that produces a *visceral reaction* ("oh, I'd actually use this"), not the one rated "best" on a scale. Polite approval is failure. We want to find the variant that shifts how the user feels about bread shopping, not the one that ranks 4.2 vs. 3.9.

### Common scaffolding (all four mockups share this)

- Same neighborhood, same time of day, same simulated eater profile (preferences: sourdough-leaning, no rye, within 2 miles).
- Same baker pool in the back-end fiction — only the *presentation* of the feed differs.
- Real-looking visual polish. Stock photos are fine; lorem-ipsum copy is not. The bread names, baker names, prices, and times must read as plausible.
- One screen each. No navigation, no flows. The home screen *is* the test.
- Footer disclaimer on each: "This is a design mockup. Nothing is real."

### Mockup A — "Density"

- **Hypothesis:** the eater comes back because *the sheer presence of options* is the surprise.
- **What's on screen:** map + list, 9–12 currently-available loaves within 10 minutes. Mix of styles. Several from bakers the eater has never heard of.
- **What's deliberately absent:** no "for you" curation, no scheduled-future content, no countdown timers. Pure here-and-now abundance.
- **What a "yes" reaction looks like:** "wait, all of this is *near me right now*?"
- **What a "no" reaction looks like:** "this is overwhelming" / "I don't know which to pick."

### Mockup B — "One Perfect Match"

- **Hypothesis:** the eater comes back because *relevance* is the surprise — the app knows what they want.
- **What's on screen:** one hero card at the top — a single loaf that matches the eater's stated preferences uncannily well, with reasoning visible ("matches your sourdough preference, 0.4 mi away, fresh as of 11am, baker has 4.9★ from 80+ eaters"). Below: 2–3 secondary options with similar reasoning.
- **What's deliberately absent:** the full feed. No map view by default. No browsing.
- **What a "yes" reaction looks like:** "this is *exactly* the kind of loaf I'd want."
- **What a "no" reaction looks like:** "I don't trust the algorithm" / "I want to see everything."

### Mockup C — "Coming Soon"

- **Hypothesis:** the eater comes back because *anticipation* is the surprise — bread is a thing-in-progress, not a thing-on-shelf.
- **What's on screen:** a feed organized by "ready in [time]." A boule comes out in 23 minutes; baguettes in 1h 40m; a miche tomorrow at 7am. Visual emphasis on the time-until-ready, with photos of the loaves *being made* (not finished).
- **What's deliberately absent:** stale options ("out of oven 4h ago") are de-emphasized or hidden. The mockup is aggressive about *what's about to happen*.
- **What a "yes" reaction looks like:** "I want to time my walk for the boule."
- **What a "no" reaction looks like:** "I just want bread, I don't want to plan a stakeout."

### Mockup D — "The Week"

- **Hypothesis:** the eater comes back because *the bakery's full upcoming schedule* is the surprise — information they've never had access to before.
- **What's on screen:** a 7-day calendar view as the home screen. Each day shows what bakers in the area have *planned* to bake, with reserve buttons. Today's available items are present but secondary; the headline is the week ahead.
- **What's deliberately absent:** the "right now" emphasis. No urgency framing. The product reads as a *planning tool*, not a hunting tool.
- **What a "yes" reaction looks like:** "I had no idea I could see what they're baking next Saturday."
- **What a "no" reaction looks like:** "I don't plan bread purchases that far ahead."

### Test protocol

Tiered by available effort — pick the tier that fits how seriously we want to take the test today.

**Tier 1 (cheap, biased, useful as smoke test).** Show all four mockups, side-by-side, to 6–8 people who currently eat bread. In person or over a video call. Single question after a 10-second pause: *"Which one of these makes you want to open the app again tomorrow? Why?"* Watch for the visceral reaction, not the answer. Disqualify polite "they all look nice" responses — push back: "if you had to delete three, which would you keep?"

**Tier 2 (medium, broader, still cheap).** Post the four mockups as static images in r/Breadit, r/Sourdough, and one local subreddit. Ask the same question. Read the comment threads, not just the votes. Look for which mockup people *talk about* unprompted — silence is failure even with a high vote count.

**Tier 3 (real test).** Recruit 10–12 paid 30-minute interviewees via screener (eats bread weekly, has bought from a bakery in last 30 days). Show mockups one at a time, in randomized order. Ask: "describe what you think this app is for," "what would make you open it again," "what would frustrate you about it." Code the transcripts for visceral reactions vs. polite ones.

### What we'd learn (and what we wouldn't)

- **What this test resolves:** which feed-shape hypothesis has the strongest first-session pull. This is the highest-leverage uncertainty in the project right now.
- **What this test does *not* resolve:** whether any of these are sustainable beyond first session. A mockup test is a first-impression instrument — retention is not on the table here.
- **What a clean win looks like:** one mockup pulls visceral reactions from a clear majority. Design follows.
- **What a messy result looks like:** different mockups win for different user segments. That's also useful — it implies Breadly may need to *show different feeds to different users*, not pick one global feed shape. (And that itself is a meaningful design decision, not a punt.)

### Still Fuzzy

- **Whether to actually build these as HTML or as static images.** HTML costs more but tests interactive expectations (does the user try to tap things?). Static images are faster and good enough for first-impression testing. Recommendation: start static, escalate to HTML only if results are ambiguous and we suspect interactivity is the missing variable.
- **Who recruits the testers.** Tier 1 is "ask friends." Tier 3 needs a screener and budget. The portfolio framing tolerates Tier 1; the real-business framing wants Tier 3. The straddle decision says we should do *both* over time — start Tier 1 this week, Tier 3 when there's a budget for it.
- **Whether a fifth variant exists that we haven't named.** The four came from one diagnosis pass. A user reaction along the lines of "none of these — what I want is X" would be the most valuable possible result. Build the test to *invite* that answer, not just to pick among four.
