// Static reference data for the Boulder seed: neighborhoods, tag catalog,
// bakery name pool, bread name pool. Pure data — no DB access here.
//
// Coordinates are real Boulder, CO. Bakers are placed with ±~300m jitter
// inside their neighborhood centroid so the map view shows believable
// spread without overlapping pins.

export type Neighborhood = {
  slug: string;
  name: string;
  centroid: { lat: number; lng: number };
};

export const NEIGHBORHOODS: Neighborhood[] = [
  { slug: "newlands",       name: "Newlands",          centroid: { lat: 40.0274, lng: -105.2820 } },
  { slug: "mapleton-hill",  name: "Mapleton Hill",     centroid: { lat: 40.0240, lng: -105.2870 } },
  { slug: "north-boulder",  name: "North Boulder",     centroid: { lat: 40.0420, lng: -105.2790 } },
  { slug: "goss-grove",     name: "Goss Grove",        centroid: { lat: 40.0190, lng: -105.2770 } },
  { slug: "university-hill",name: "University Hill",   centroid: { lat: 40.0070, lng: -105.2900 } },
  { slug: "whittier",       name: "Whittier",          centroid: { lat: 40.0220, lng: -105.2680 } },
  { slug: "martin-acres",   name: "Martin Acres",      centroid: { lat: 39.9870, lng: -105.2540 } },
  { slug: "table-mesa",     name: "Table Mesa",        centroid: { lat: 39.9890, lng: -105.2620 } },
  { slug: "chautauqua",     name: "Chautauqua",        centroid: { lat: 39.9990, lng: -105.2810 } },
];

// Tag catalog — single mechanism per universal-laws/data-driven-architecture.
// `kind` is informational; matching is by slug.
export const TAGS: { slug: string; label: string; kind: "style" | "dietary" | "ingredient" | "process" | "kitchen" }[] = [
  // styles
  { slug: "sourdough",     label: "Sourdough",      kind: "style" },
  { slug: "country",       label: "Country",        kind: "style" },
  { slug: "baguette",      label: "Baguette",       kind: "style" },
  { slug: "miche",         label: "Miche",          kind: "style" },
  { slug: "ciabatta",      label: "Ciabatta",       kind: "style" },
  { slug: "focaccia",      label: "Focaccia",       kind: "style" },
  { slug: "brioche",       label: "Brioche",        kind: "style" },
  { slug: "rye-bread",     label: "Rye",            kind: "style" },
  { slug: "pain-de-mie",   label: "Pain de mie",    kind: "style" },
  // dietary
  { slug: "vegan",         label: "Vegan",          kind: "dietary" },
  { slug: "gluten-free",   label: "Gluten-free",    kind: "dietary" },
  { slug: "dairy-free",    label: "Dairy-free",     kind: "dietary" },
  { slug: "nut-free",      label: "Nut-free",       kind: "dietary" },
  // ingredients
  { slug: "wheat",         label: "Wheat",          kind: "ingredient" },
  { slug: "rye",           label: "Rye",            kind: "ingredient" },
  { slug: "spelt",         label: "Spelt",          kind: "ingredient" },
  { slug: "seeded",        label: "Seeded",         kind: "ingredient" },
  { slug: "olive-oil",     label: "Olive oil",      kind: "ingredient" },
  { slug: "rosemary",      label: "Rosemary",       kind: "ingredient" },
  // process
  { slug: "long-ferment",  label: "Long ferment",   kind: "process" },
  { slug: "wood-fired",    label: "Wood-fired",     kind: "process" },
  { slug: "starter-50yr",  label: "50-yr starter",  kind: "process" },
  // kitchen
  { slug: "nut-free-kitchen",   label: "Nut-free kitchen",   kind: "kitchen" },
  { slug: "dairy-free-kitchen", label: "Dairy-free kitchen", kind: "kitchen" },
];

// 30 bakery names across the casual → side-hustle → pro spectrum.
export const BAKERY_NAMES: { name: string; bio: string; tier: "casual" | "side" | "pro" }[] = [
  { name: "Flatiron Sourdough",     bio: "Wood-fired country loaves out of a basement oven. Saturdays mostly.", tier: "side" },
  { name: "Foothills Bread Co.",    bio: "Daily bakes for the North Boulder co-op crowd. Cottage-licensed.",     tier: "pro" },
  { name: "Boulder Creek Bakery",   bio: "Fifth-generation rye recipes. Run with my partner out of our garage.", tier: "side" },
  { name: "Pearl Street Provisions",bio: "We bake the day's bread by 7am, every day. Pickup off Pearl.",         tier: "pro" },
  { name: "Chautauqua Crusts",      bio: "Just me, my deck oven, and a 12-year-old starter named Phil.",         tier: "side" },
  { name: "Marpa Bakehouse",        bio: "Whole-grain breads, mostly. Tibetan-influenced flatbreads on Sundays.", tier: "pro" },
  { name: "North Boulder Levain",   bio: "Naturally leavened, long-fermented, no commercial yeast. Tues/Fri.",    tier: "side" },
  { name: "Mapleton Mill",          bio: "Stone-milled flour, baked the same morning. Limited daily quantity.",   tier: "pro" },
  { name: "Hill Hearth Bread",      bio: "University Hill, side hustle, Saturday baguettes are the headliner.",   tier: "side" },
  { name: "Goss Grain",             bio: "All grain, all the time. Whole-spelt, einkorn, occasional emmer.",      tier: "side" },
  { name: "Tilden's Loaves",        bio: "Casual baker. I post when I have extras. Don't expect much.",           tier: "casual" },
  { name: "Sara's Sourdough",       bio: "Side hustle from Mapleton Hill. Same loaf every Tuesday + Friday.",     tier: "side" },
  { name: "Wonderland Lake Bread",  bio: "Folks ask for the seeded miche; that's the one I keep making.",         tier: "pro" },
  { name: "Settlers' Sourdough",    bio: "Just figuring this out. First few months. Nice when neighbors take it.",tier: "casual" },
  { name: "Coal Creek Crumb",       bio: "Dense, dark, rye-forward. Not for everyone, that's fine.",              tier: "side" },
  { name: "Switzerland Trail Bakery",bio: "Storefront-adjacent. Open kitchen. Come watch the bake if you want.",  tier: "pro" },
  { name: "Folsom Loaf",            bio: "Olive-oil focaccia is my whole personality. Bake every other day.",     tier: "side" },
  { name: "Boulder Pretzel Co.",    bio: "Pretzels and bread. Lye baths, real-deal soft pretzels for game days.", tier: "side" },
  { name: "Diagonal Highway Bread", bio: "Drive-by pickup off the Diagonal. Email if you want a loaf held.",      tier: "casual" },
  { name: "Saddle Rock Sourdough",  bio: "Rugged, rustic, nothing precious. Big country loaves. That's it.",      tier: "side" },
  { name: "Coyote Trail Bakehouse", bio: "Pro shop running out of a converted shed. Daily bakes by reservation.", tier: "pro" },
  { name: "Anemone Hill Hearth",    bio: "Naturally leavened brioche. Yes, you read that right.",                 tier: "side" },
  { name: "Ezra & Co",              bio: "Just Ezra. Rosemary focaccia + a country loaf. Home kitchen, nut-free.",tier: "casual" },
  { name: "Dorothy Bakes",          bio: "Baked bread for 40 years. Now finally selling some. Tuesday + Saturday.",tier: "side" },
  { name: "Skunk Creek Bakery",     bio: "Long fermentation, big flavor. Sneak previews on Instagram.",           tier: "side" },
  { name: "Twin Lakes Loaves",      bio: "Two ovens, two of us, double the bread. Order ahead.",                  tier: "pro" },
  { name: "Whittier Wheat",         bio: "Whole-wheat sandwich loaves and the occasional caraway rye.",           tier: "side" },
  { name: "Boulder Mountain Bread", bio: "Hiked-in-flour, kidding, but the ethos is yes. Pro storefront.",        tier: "pro" },
  { name: "Coot Lake Bakery",       bio: "Seasonal everything. Spring sourdough, summer focaccia, fall miche.",   tier: "pro" },
  { name: "Casey Just Baking",      bio: "Casual. Posting only when I have surplus. New to all of this.",         tier: "casual" },
];

// Bread name pool, paired with a tag-slug set the listing inherits.
export const BREAD_TYPES: { name: string; type: string; tags: string[] }[] = [
  { name: "Country sourdough boule",   type: "sourdough", tags: ["sourdough", "country", "long-ferment", "wheat"] },
  { name: "Seeded rye-wheat blend",    type: "rye",       tags: ["rye-bread", "rye", "wheat", "seeded", "long-ferment"] },
  { name: "Whole-wheat sandwich loaf", type: "sourdough", tags: ["sourdough", "wheat"] },
  { name: "Saturday baguette",         type: "baguette",  tags: ["baguette", "wheat", "long-ferment"] },
  { name: "Olive oil focaccia",        type: "focaccia",  tags: ["focaccia", "wheat", "olive-oil", "vegan"] },
  { name: "Rosemary focaccia",         type: "focaccia",  tags: ["focaccia", "wheat", "olive-oil", "rosemary", "vegan"] },
  { name: "Pan rústico",               type: "miche",     tags: ["miche", "country", "long-ferment", "wheat"] },
  { name: "Caraway rye",               type: "rye",       tags: ["rye-bread", "rye", "seeded"] },
  { name: "Pumpernickel",              type: "rye",       tags: ["rye-bread", "rye", "long-ferment"] },
  { name: "Whole-spelt boule",         type: "sourdough", tags: ["sourdough", "spelt", "long-ferment"] },
  { name: "Brioche loaf",              type: "brioche",   tags: ["brioche", "wheat"] },
  { name: "Ciabatta rolls",            type: "ciabatta",  tags: ["ciabatta", "wheat", "olive-oil"] },
  { name: "Country miche (1.2kg)",     type: "miche",     tags: ["miche", "country", "long-ferment", "wheat"] },
  { name: "50-year starter sourdough", type: "sourdough", tags: ["sourdough", "long-ferment", "starter-50yr", "wheat"] },
  { name: "Wood-fired country loaf",   type: "sourdough", tags: ["sourdough", "country", "wood-fired", "wheat"] },
  { name: "Soft pretzel (six-pack)",   type: "ciabatta",  tags: ["wheat"] }, // pretzel-as-ciabatta is fine for the type enum
  { name: "Olive-rosemary miche",      type: "miche",     tags: ["miche", "olive-oil", "rosemary", "wheat", "vegan"] },
  { name: "Sunflower seeded sourdough",type: "sourdough", tags: ["sourdough", "seeded", "wheat", "long-ferment"] },
];

// A handful of curated Unsplash photo IDs of bread (verified bread-shaped).
export const BREAD_PHOTOS = [
  "photo-1509440159596-0249088772ff",
  "photo-1568254183919-78a4f43a2877",
  "photo-1586444248890-9f1a99b3c4db",
  "photo-1555507036-ab1f4038808a",
  "photo-1603047640218-ee30ed10a51d",
  "photo-1549931319-a545dcf3bc73",
  "photo-1592151450162-cd23c4ff2f44",
  "photo-1567306226416-28f0efdc88ce",
  "photo-1534620808146-d33bb39128b2",
  "photo-1608198093002-ad4e005484ec",
  "photo-1587830754586-b2ddafe3eaab",
  "photo-1517686469429-8bdb88b9f907",
];

export const photoUrl = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&auto=format&fit=crop`;

// First-name pool used for "Casey Just Baking", "Dorothy Bakes", etc., and
// for plausible eater display names.
export const FIRST_NAMES = [
  "Casey", "Dorothy", "Ezra", "Sara", "Marisol", "Tomás", "Rivka",
  "Elena", "Samir", "Avery", "Jules", "Noor", "Brennan", "Ines",
  "Sully", "Kai", "Ana", "Theo", "Wren", "Cyrus",
];
