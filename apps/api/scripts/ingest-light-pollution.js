import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NASA Black Marble 2016 "01deg" equirectangular composite (3600x1800,
// matching our target 0.1° grid exactly) — a rendered poster image, not
// calibrated VIIRS radiance data (see API_SOURCES.md / DECISIONS.md).
// The 3km-per-pixel tier (13500x6750) is NASA's smallest science-grade
// asset for this dataset but still decodes to >1GB of working memory in
// jpeg-js, exceeding its default maxMemoryUsageInMB; this 01deg variant is
// the smallest full-globe JPEG NASA publishes and needs no resizing at all.
const VIIRS_IMAGE_URL = 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg';
const LOCAL_IMG = path.join(__dirname, 'BlackMarble.jpg');

const RESOLUTION_DEG = 0.1;
const WIDTH = Math.round(360 / RESOLUTION_DEG); // 3600
const HEIGHT = Math.round(180 / RESOLUTION_DEG); // 1800

async function ingestLightPollution() {
  let imagePath = LOCAL_IMG;

  if (!fs.existsSync(LOCAL_IMG)) {
    console.log(`Local image not found at ${LOCAL_IMG}.`);
    console.log(`Downloading Black Marble image from NASA...`);
    const res = await fetch(VIIRS_IMAGE_URL);
    if (!res.ok) {
      throw new Error(`Failed to download image: ${res.status} ${res.statusText}. Please manually download a Black Marble equirectangular JPEG and place it at ${LOCAL_IMG}`);
    }
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(LOCAL_IMG, Buffer.from(buffer));
    console.log('Download complete.');
  }

  console.log(`Loading image via Jimp... (this may take a moment for large images)`);
  const image = await Jimp.read(imagePath);
  
  console.log(`Resizing image to ${WIDTH}x${HEIGHT} to match ${RESOLUTION_DEG}° resolution...`);
  image.resize(WIDTH, HEIGHT);

  console.log('Mapping VIIRS radiance (luma) to Bortle Scale (1-9)...');
  const grid = new Uint8Array(WIDTH * HEIGHT);

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      // Get pixel color
      const hex = image.getPixelColor(x, y);
      const rgba = Jimp.intToRGBA(hex);
      
      // Calculate luma (grayscale brightness 0-255)
      const luma = 0.2126 * rgba.r + 0.7152 * rgba.g + 0.0722 * rgba.b;

      // Approximate VIIRS radiance to Bortle (1-9)
      // True VIIRS conversion is non-linear, but for this static asset we use a 
      // standard heuristic mapping where 0 luma = Bortle 1 (pristine dark),
      // and max luma (255) = Bortle 9 (inner city).
      let bortle = 1;
      if (luma > 200) bortle = 9;
      else if (luma > 150) bortle = 8;
      else if (luma > 100) bortle = 7;
      else if (luma > 50) bortle = 6;
      else if (luma > 25) bortle = 5;
      else if (luma > 10) bortle = 4;
      else if (luma > 5) bortle = 3;
      else if (luma > 1) bortle = 2;

      grid[y * WIDTH + x] = bortle;
    }
  }

  const outDir = path.join(__dirname, '..', '..', 'web', 'public', 'data');
  const outFile = path.join(outDir, 'bortle-grid.bin');

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, Buffer.from(grid.buffer));

  console.log(`Success! Saved Bortle grid to ${outFile} (${(grid.byteLength / 1024 / 1024).toFixed(2)} MB)`);
}

ingestLightPollution().catch(console.error);
