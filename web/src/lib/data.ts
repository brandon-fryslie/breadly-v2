// Shared mockup data. Same baker pool + listing pool across all four variants —
// only the *presentation* of the feed differs. This is the test invariant.

export type Tag =
  | "sourdough"
  | "rye"
  | "wheat"
  | "gluten-free"
  | "vegan"
  | "nut-free"
  | "dairy-free"
  | "seeded"
  | "country"
  | "enriched"
  | "long-ferment"
  | "starter-50yr";

export type Baker = {
  id: string;
  name: string;
  neighborhood: string;
  rating: number; // 0–5
  reviews: number;
  bio: string;
  kitchenTags: Tag[];
};

export type Listing = {
  id: string;
  bakerId: string;
  breadName: string;
  type: "sourdough" | "baguette" | "rye" | "ciabatta" | "miche" | "focaccia" | "brioche" | "pita";
  tags: Tag[];
  // Times are minutes from "now" (negative = already out of oven, positive = scheduled).
  // -45 means it came out of the oven 45 min ago. +90 means it's coming out in 90 min.
  readyMinutesFromNow: number;
  priceCents: number;
  qty: number;
  distanceMi: number;
  photo: string; // unsplash photo id
  blurb: string; // a real-feeling sentence the baker wrote
  scheduledDayOffset?: number; // 0 = today, 1 = tomorrow, etc. (for week view)
};

const u = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&auto=format&fit=crop`;

export const bakers: Baker[] = [
  {
    id: "elena",
    name: "Elena's Kitchen",
    neighborhood: "Hawthorne",
    rating: 4.9,
    reviews: 142,
    bio: "Wood-fired sourdough out of my home. 50-year-old starter from my abuela.",
    kitchenTags: ["nut-free", "dairy-free"],
  },
  {
    id: "samir",
    name: "Samir Bakes",
    neighborhood: "Sellwood",
    rating: 4.8,
    reviews: 67,
    bio: "Side hustle. Country loaves Tues/Fri, baguettes Saturday morning.",
    kitchenTags: ["nut-free"],
  },
  {
    id: "north-flour",
    name: "North Flour Co.",
    neighborhood: "Mississippi",
    rating: 4.7,
    reviews: 380,
    bio: "Small storefront. Daily bakes, weekly specials. Cottage-licensed.",
    kitchenTags: [],
  },
  {
    id: "rivka",
    name: "Rivka's Rye",
    neighborhood: "Kerns",
    rating: 4.9,
    reviews: 51,
    bio: "Rye, rye, and more rye. Caraway optional. No wheat in the kitchen.",
    kitchenTags: ["dairy-free"],
  },
  {
    id: "casey",
    name: "Casey (just baking)",
    neighborhood: "Richmond",
    rating: 4.6,
    reviews: 12,
    bio: "Just figuring out what people want. Posting when I have extras.",
    kitchenTags: ["nut-free", "dairy-free"],
  },
  {
    id: "tomas",
    name: "Tomas — Pan Casero",
    neighborhood: "Foster-Powell",
    rating: 4.8,
    reviews: 94,
    bio: "Pan rústico, focaccia, and the occasional brioche when the mood strikes.",
    kitchenTags: ["nut-free"],
  },
];

export const listings: Listing[] = [
  {
    id: "l1",
    bakerId: "elena",
    breadName: "Country sourdough boule",
    type: "sourdough",
    tags: ["sourdough", "long-ferment", "starter-50yr", "nut-free", "dairy-free"],
    readyMinutesFromNow: -25,
    priceCents: 1200,
    qty: 4,
    distanceMi: 0.3,
    photo: u("photo-1509440159596-0249088772ff"),
    blurb: "Crackly crust, open crumb. Came out at 9:35.",
  },
  {
    id: "l2",
    bakerId: "elena",
    breadName: "Seeded rye-wheat blend",
    type: "rye",
    tags: ["rye", "wheat", "seeded", "long-ferment", "nut-free"],
    readyMinutesFromNow: -90,
    priceCents: 1400,
    qty: 1,
    distanceMi: 0.3,
    photo: u("photo-1568254183919-78a4f43a2877"),
    blurb: "Sunflower + flax on top. Last one until Friday.",
  },
  {
    id: "l3",
    bakerId: "samir",
    breadName: "Saturday baguette",
    type: "baguette",
    tags: ["wheat", "long-ferment"],
    readyMinutesFromNow: 23,
    priceCents: 600,
    qty: 12,
    distanceMi: 0.9,
    photo: u("photo-1586444248890-9f1a99b3c4db"),
    blurb: "Out at 10:55. I bake these every Saturday.",
  },
  {
    id: "l4",
    bakerId: "samir",
    breadName: "Country loaf",
    type: "sourdough",
    tags: ["sourdough", "country", "long-ferment"],
    readyMinutesFromNow: -180,
    priceCents: 1000,
    qty: 2,
    distanceMi: 0.9,
    photo: u("photo-1555507036-ab1f4038808a"),
    blurb: "Tuesday's bake. Still soft in the middle.",
  },
  {
    id: "l5",
    bakerId: "north-flour",
    breadName: "Olive oil focaccia (sheet)",
    type: "focaccia",
    tags: ["wheat", "vegan", "nut-free"],
    readyMinutesFromNow: 90,
    priceCents: 1800,
    qty: 6,
    distanceMi: 1.4,
    photo: u("photo-1603047640218-ee30ed10a51d"),
    blurb: "Rosemary + flaky salt. Half-sheet, sliced.",
  },
  {
    id: "l6",
    bakerId: "north-flour",
    breadName: "Whole-wheat sandwich loaf",
    type: "sourdough",
    tags: ["wheat", "nut-free"],
    readyMinutesFromNow: -45,
    priceCents: 800,
    qty: 8,
    distanceMi: 1.4,
    photo: u("photo-1549931319-a545dcf3bc73"),
    blurb: "Soft crumb, good toast. Daily bake.",
  },
  {
    id: "l7",
    bakerId: "rivka",
    breadName: "Caraway rye",
    type: "rye",
    tags: ["rye", "seeded", "dairy-free"],
    readyMinutesFromNow: -10,
    priceCents: 1100,
    qty: 3,
    distanceMi: 1.8,
    photo: u("photo-1592151450162-cd23c4ff2f44"),
    blurb: "Just out. The kitchen smells incredible.",
  },
  {
    id: "l8",
    bakerId: "rivka",
    breadName: "Pumpernickel",
    type: "rye",
    tags: ["rye", "long-ferment", "dairy-free"],
    readyMinutesFromNow: -240,
    priceCents: 1300,
    qty: 1,
    distanceMi: 1.8,
    photo: u("photo-1567306226416-28f0efdc88ce"),
    blurb: "Yesterday's bake — better tomorrow honestly.",
  },
  {
    id: "l9",
    bakerId: "casey",
    breadName: "Two extra sourdough mini-boules",
    type: "sourdough",
    tags: ["sourdough", "nut-free", "dairy-free"],
    readyMinutesFromNow: -15,
    priceCents: 700,
    qty: 2,
    distanceMi: 0.6,
    photo: u("photo-1534620808146-d33bb39128b2"),
    blurb: "Made too many. Take them off my hands.",
  },
  {
    id: "l10",
    bakerId: "tomas",
    breadName: "Pan rústico",
    type: "miche",
    tags: ["wheat", "country", "long-ferment", "nut-free"],
    readyMinutesFromNow: 45,
    priceCents: 1500,
    qty: 3,
    distanceMi: 1.1,
    photo: u("photo-1608198093002-ad4e005484ec"),
    blurb: "1.2kg miche. Built for a dinner party.",
  },
  {
    id: "l11",
    bakerId: "tomas",
    breadName: "Rosemary focaccia",
    type: "focaccia",
    tags: ["wheat", "vegan", "nut-free"],
    readyMinutesFromNow: -60,
    priceCents: 1000,
    qty: 4,
    distanceMi: 1.1,
    photo: u("photo-1587830754586-b2ddafe3eaab"),
    blurb: "Olive oil pour-over before the bake.",
  },
  {
    id: "l12",
    bakerId: "tomas",
    breadName: "Brioche tomorrow",
    type: "brioche",
    tags: ["wheat", "enriched"],
    readyMinutesFromNow: 60 * 22,
    priceCents: 1600,
    qty: 6,
    distanceMi: 1.1,
    photo: u("photo-1517686469429-8bdb88b9f907"),
    blurb: "Tomorrow morning. Pre-order if you want one held.",
    scheduledDayOffset: 1,
  },
];

// Forward-looking schedule entries (for variant D, the week view).
// These are *planned* bakes that haven't started yet.
export type Scheduled = {
  id: string;
  bakerId: string;
  breadName: string;
  tags: Tag[];
  priceCents: number;
  qty: number;
  dayOffset: number; // 0 = today, 6 = next of same weekday
  readyTimeLabel: string; // e.g. "8:30am"
};

export const schedule: Scheduled[] = [
  { id: "s1", bakerId: "elena", breadName: "Country sourdough", tags: ["sourdough", "long-ferment"], priceCents: 1200, qty: 6, dayOffset: 1, readyTimeLabel: "9:30am" },
  { id: "s2", bakerId: "elena", breadName: "Seeded rye-wheat", tags: ["rye", "seeded"], priceCents: 1400, qty: 4, dayOffset: 1, readyTimeLabel: "9:30am" },
  { id: "s3", bakerId: "samir", breadName: "Country loaf", tags: ["sourdough", "country"], priceCents: 1000, qty: 8, dayOffset: 2, readyTimeLabel: "6:00am" },
  { id: "s4", bakerId: "north-flour", breadName: "Whole-wheat sandwich", tags: ["wheat"], priceCents: 800, qty: 12, dayOffset: 1, readyTimeLabel: "7:00am" },
  { id: "s5", bakerId: "north-flour", breadName: "Olive oil focaccia", tags: ["vegan"], priceCents: 1800, qty: 6, dayOffset: 1, readyTimeLabel: "11:00am" },
  { id: "s6", bakerId: "north-flour", breadName: "Sunday cinnamon swirl", tags: ["wheat", "enriched"], priceCents: 1600, qty: 8, dayOffset: 4, readyTimeLabel: "8:00am" },
  { id: "s7", bakerId: "rivka", breadName: "Caraway rye", tags: ["rye", "seeded"], priceCents: 1100, qty: 6, dayOffset: 2, readyTimeLabel: "10:00am" },
  { id: "s8", bakerId: "rivka", breadName: "Pumpernickel", tags: ["rye"], priceCents: 1300, qty: 4, dayOffset: 5, readyTimeLabel: "10:00am" },
  { id: "s9", bakerId: "tomas", breadName: "Pan rústico", tags: ["country"], priceCents: 1500, qty: 4, dayOffset: 0, readyTimeLabel: "11:30am" },
  { id: "s10", bakerId: "tomas", breadName: "Brioche", tags: ["enriched"], priceCents: 1600, qty: 6, dayOffset: 1, readyTimeLabel: "8:30am" },
  { id: "s11", bakerId: "tomas", breadName: "Rosemary focaccia", tags: ["vegan"], priceCents: 1000, qty: 6, dayOffset: 3, readyTimeLabel: "4:00pm" },
  { id: "s12", bakerId: "samir", breadName: "Saturday baguettes (12)", tags: ["wheat"], priceCents: 600, qty: 24, dayOffset: 6, readyTimeLabel: "11:00am" },
  { id: "s13", bakerId: "elena", breadName: "Friday seeded rye", tags: ["rye", "seeded"], priceCents: 1400, qty: 8, dayOffset: 5, readyTimeLabel: "9:30am" },
];

// The simulated eater whose feed we are rendering across all four variants.
export const eater = {
  name: "You",
  neighborhood: "Hawthorne",
  preferences: {
    include: ["sourdough"] as Tag[],
    exclude: ["rye"] as Tag[],
    needs: [] as Tag[], // hard filters
  },
  radiusMi: 2,
};

export const bakerById = (id: string) => bakers.find((b) => b.id === id)!;

export const fmtPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const fmtTime = (minutesFromNow: number) => {
  if (minutesFromNow < 0) {
    const ago = Math.abs(minutesFromNow);
    if (ago < 60) return `${ago} min ago`;
    const h = Math.floor(ago / 60);
    return h === 1 ? "1 hr ago" : `${h} hrs ago`;
  }
  if (minutesFromNow === 0) return "out of oven";
  if (minutesFromNow < 60) return `in ${minutesFromNow} min`;
  const h = Math.floor(minutesFromNow / 60);
  const m = minutesFromNow % 60;
  if (h < 24) return m ? `in ${h}h ${m}m` : `in ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "tomorrow" : `in ${d} days`;
};

export const dayLabel = (offset: number) => {
  const days = ["Today", "Tomorrow", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days[offset] ?? `+${offset}d`;
};

// "Match score" — used by variant B. Crude but plausible.
export const matchScore = (l: Listing): number => {
  let score = 0;
  if (eater.preferences.include.some((t) => l.tags.includes(t))) score += 5;
  if (eater.preferences.exclude.some((t) => l.tags.includes(t))) score -= 10;
  score += Math.max(0, 3 - l.distanceMi); // closer is better
  score += (bakerById(l.bakerId).rating - 4.5) * 4; // small lift for high rating
  if (l.readyMinutesFromNow > -120 && l.readyMinutesFromNow < 180) score += 2; // recent or imminent
  return score;
};
