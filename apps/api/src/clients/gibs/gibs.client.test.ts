import { describe, it, expect } from 'vitest';
import { getGibsTileUrl } from './gibs.client.js';

describe('getGibsTileUrl', () => {
  it('constructs correct URL with defaults', () => {
    const url = getGibsTileUrl({
      layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
      date: '2026-07-14',
    });
    expect(url).toBe('https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/2026-07-14/250m/0/0/0.jpeg');
  });

  it('constructs correct URL with custom tile parameters', () => {
    const url = getGibsTileUrl({
      layer: 'MODIS_Aqua_CorrectedReflectance_TrueColor',
      date: '2026-07-15',
      tileMatrixSet: '1km',
      format: 'png',
      z: 2,
      x: 1,
      y: 3,
    });
    expect(url).toBe('https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/MODIS_Aqua_CorrectedReflectance_TrueColor/default/2026-07-15/1km/2/3/1.png');
  });
});
