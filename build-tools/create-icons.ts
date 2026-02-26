// This file is used to create icons for the manifest.json file.
// Place an image in the public/assets/images folder and run: `bun run icons` from the root directory.
// Make sure to change the filename variable to the name of your image.
// This script uses 'sharp' for fast, high-quality image resizing without external system dependencies.

import sharp from 'sharp';
import { resolve, join } from 'path';

// Use import.meta.dir for Bun to get current directory
const currentDir = import.meta.dir;
const root = resolve(currentDir, '..', 'public', 'assets', 'images');
const filename = 'icon.png';

const sizes = [16, 32, 48, 128] as const;

/**
 * Creates icons from an image for the manifest.
 * Sizes: 16, 32, 48, 128
 */
async function createIcons() {
  const srcPath = join(root, filename);

  for (const size of sizes) {
    const dstPath = join(root, `icon${size}.png`);

    try {
      await sharp(srcPath).resize(size, size).toFile(dstPath);

      console.log(`✓ Created icon${size}.png (${size}x${size})`);
    } catch (err) {
      if (err instanceof Error) {
        console.error(`✗ Failed to create icon${size}.png: ${err.message}`);
      } else {
        console.error(`✗ Failed to create icon${size}.png: Unknown error`);
      }
    }
  }
}

createIcons();
