// UI-shape types. The DB schema (`src/db/schema.ts`) holds storage shape;
// query helpers in `src/lib/queries.ts` project DB rows into these shapes
// for the route components. Keeping these split lets the UI evolve
// independently of the storage model.

export type UiTag = string;

export type UiBaker = {
  id: string; // user_id of the baker
  slug: string;
  name: string; // bakery name
  ownerName: string; // first name displayed on cards
  neighborhood: string;
  rating: number; // 0–5; placeholder until M2 ratings ship
  reviews: number; // placeholder until M2
  bio: string;
  kitchenTags: UiTag[];
};

export type UiListing = {
  id: string;
  bakerId: string;
  baker: UiBaker; // embedded so cards don't need a second lookup
  breadName: string;
  type: "sourdough" | "baguette" | "rye" | "ciabatta" | "miche" | "focaccia" | "brioche" | "pita";
  tags: UiTag[];
  // Minutes from "now". Negative = already out of oven; positive = scheduled.
  readyMinutesFromNow: number;
  priceCents: number;
  qty: number;
  distanceMi: number;
  photo: string;
  blurb: string;
  scheduledDayOffset?: number;
};

// 7-day forward schedule entry as the UI consumes it.
export type UiScheduled = {
  id: string;
  bakerId: string;
  baker: UiBaker;
  breadName: string;
  tags: UiTag[];
  priceCents: number;
  qty: number;
  dayOffset: number; // 0 = today
  readyTimeLabel: string; // "9:30am"
};

export type UiEater = {
  id: string;
  name: string;
  neighborhood: string;
  preferences: {
    include: UiTag[];
    exclude: UiTag[];
    needs: UiTag[];
  };
  radiusMi: number;
};
