/**
 * NASA GIBS URL constructor.
 *
 * GIBS does not require fetching JSON payloads; it serves map tiles and imagery
 * directly to the frontend. This client simply provides the URL construction
 * logic so the backend can pass down the correct URLs.
 */

const BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best';

export interface GibsLayerOptions {
  layer: string; // e.g. 'VIIRS_SNPP_CorrectedReflectance_TrueColor'
  date: string; // YYYY-MM-DD
  tileMatrixSet?: string; // e.g. '250m'
  format?: string; // e.g. 'jpeg'
  z?: number; // zoom level
  x?: number; // tile x
  y?: number; // tile y
}

/**
 * Constructs a GIBS WMTS URL for a specific tile.
 */
export function getGibsTileUrl(options: GibsLayerOptions): string {
  const { layer, date, tileMatrixSet = '250m', format = 'jpeg', z = 0, x = 0, y = 0 } = options;

  return `${BASE}/${layer}/default/${date}/${tileMatrixSet}/${z}/${y}/${x}.${format}`;
}
