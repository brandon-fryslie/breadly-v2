// One registry, one place to add a pack. The dev-tools UI and the seed CLI
// both read from here — no second list. [LAW:one-source-of-truth]

import { resetPack } from "./reset";
import { weekendMorningPack } from "./weekend-morning";
import type { Pack } from "./types";

export const PACKS: ReadonlyArray<Pack> = [resetPack, weekendMorningPack];

export function getPack(name: string): Pack | undefined {
  return PACKS.find((p) => p.name === name);
}
