"use client";

import { Map } from "@/components/Map";

export function MapVerify() {
  return (
    <div className="rounded-xl border border-stone-200 overflow-hidden">
      <Map className="w-full h-[480px]" />
      <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 text-xs text-stone-500">
        Centered on Boulder, CO (40.015°N, 105.270°W) · zoom 13 · if the map
        renders above, MAP1 is complete.
      </div>
    </div>
  );
}
