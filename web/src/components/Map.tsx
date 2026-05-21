"use client";

import { APIProvider, Map as GoogleMap } from "@vis.gl/react-google-maps";

// [LAW:types-are-the-program] A missing key is external-config input at a trust
// boundary. Validate once here so the rest of the component sees a guaranteed
// `string`; the alternative `!` laundered `undefined` into Google's apiKey and
// produced a silently broken map instead of a loud failure.
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  throw new Error(
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set — copy web/.env.local.example to web/.env.local and add a Maps JavaScript API key.",
  );
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
  return (
    <APIProvider apiKey={API_KEY}>
      <GoogleMap
        mapId="breadly-map"
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
