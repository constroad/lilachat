/** Where the phone is, as the blue dot of any map app (José 27/11: «Mi ubicación» moved the map but drew nothing). */
export type LocatedPoint = { lat: number; lng: number };

type MyLocationFeature = { type: 'Feature'; properties: Record<string, never>; geometry: { type: 'Point'; coordinates: [number, number] } };
export type MyLocationCollection = { type: 'FeatureCollection'; features: MyLocationFeature[] };

export function myLocationCollection(point: LocatedPoint | null): MyLocationCollection {
  if (!point) return { type: 'FeatureCollection', features: [] };
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [point.lng, point.lat] } }] };
}

/** The halo shows the dot is live; the white ring keeps it readable on the dark and the light map. */
export const MY_LOCATION_HALO_PAINT = { 'circle-color': '#2563eb', 'circle-opacity': 0.18, 'circle-radius': 22 } as const;
export const MY_LOCATION_DOT_PAINT = { 'circle-color': '#2563eb', 'circle-radius': 8, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } as const;
