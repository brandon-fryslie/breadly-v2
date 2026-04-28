import type { UiListing } from "./types";

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

// Pure scoring used by the "One Perfect Match" variant to rank listings.
export const matchScore = (
  l: UiListing,
  prefs: { include: string[]; exclude: string[] },
): number => {
  let score = 0;
  if (prefs.include.some((t) => l.tags.includes(t))) score += 5;
  if (prefs.exclude.some((t) => l.tags.includes(t))) score -= 10;
  score += Math.max(0, 3 - l.distanceMi);
  score += (l.baker.rating - 4.5) * 4;
  if (l.readyMinutesFromNow > -120 && l.readyMinutesFromNow < 180) score += 2;
  return score;
};
