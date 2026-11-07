/** The build that runs under our CSP: its worker comes from our own origin, not from a `blob:`. */
declare module 'maplibre-gl/dist/maplibre-gl-csp' {
  import * as maplibregl from 'maplibre-gl';
  export default maplibregl;
}
declare module 'maplibre-gl/dist/maplibre-gl-csp-worker?url' {
  const workerUrl: string;
  export default workerUrl;
}
