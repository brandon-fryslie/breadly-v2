"use client";

import { Map, BOULDER_CENTER, DEFAULT_ZOOM } from "@/components/Map";

export function MapVerify() {
  // [LAW:one-source-of-truth] Display the real default center/zoom rather than
  // a hand-copied caption that drifts from the constants it describes.
  const { lat, lng } = BOULDER_CENTER;
  return (
    <div className="rounded-xl border border-stone-200 overflow-hidden">
      <Map className="w-full h-[480px]" />
      <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 text-xs text-stone-500">
        Centered on Boulder, CO ({lat}°N, {Math.abs(lng)}°W) · zoom{" "}
        {DEFAULT_ZOOM} · if the map renders above, MAP1 is complete.
      </div>
    </div>
  );
}
