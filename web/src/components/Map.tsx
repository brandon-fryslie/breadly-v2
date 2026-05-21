"use client";

import { APIProvider, Map as GoogleMap } from "@vis.gl/react-google-maps";

// [LAW:types-are-the-program] A missing key is external-config input at a trust
// boundary. This getter's `string` return type is the promise; the throw is the
// only escape, so callers can never launder `undefined` into Google's apiKey
// (which silently renders a broken map instead of failing loudly).
//
// [LAW:dataflow-not-control-flow] Read at render, not module load. The key is
// needed when a map is drawn, so validation lives at that boundary — keeping
// imports side-effect-free (BOULDER_CENTER is importable without a key, and
// `next build` stays green), matching the lazy-env convention in db/client.ts.
function mapsApiKey(): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set. Locally: copy " +
        "web/.env.local.example to web/.env.local and add a Maps JavaScript " +
        "API key. Deployed: it is inlined at build time, so set the " +
        "GOOGLE_MAPS_API_KEY build secret (see .github/workflows/ci.yml).",
    );
  }
  return key;
}

// Boulder, CO — default center for all maps in the app
export const BOULDER_CENTER = { lat: 40.015, lng: -105.2705 };
export const DEFAULT_ZOOM = 13;

type MapProps = {
  center?: google.maps.LatLngLiteral;
  zoom?: number;
  className?: string;
  children?: React.ReactNode;
};

export function Map({
  center = BOULDER_CENTER,
  zoom = DEFAULT_ZOOM,
  className,
  children,
}: MapProps) {
  // [LAW:one-source-of-truth] The Map ID is per-GCP-project config like the API
  // key — sourced from env, not a source constant. A value enables cloud
  // styling + Advanced Markers (the pins ED5 adds later).
  //
  // [LAW:types-are-the-program] Collapse blank/whitespace to undefined at the
  // read. An unset env var arrives as "" (the `KEY=` form, the Dockerfile ARG
  // default, an empty CI var) — `mapId=""` is an illegal in-between Google may
  // treat as a bad ID, so the rest of the code only ever sees real-id-or-absent.
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || undefined;
  return (
    <APIProvider apiKey={mapsApiKey()}>
      <GoogleMap
        mapId={mapId}
        center={center}
        zoom={zoom}
        className={className}
        gestureHandling="greedy"
        disableDefaultUI={false}
      >
        {children}
      </GoogleMap>
    </APIProvider>
  );
}
