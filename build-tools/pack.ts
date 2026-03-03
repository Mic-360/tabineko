import AdmZip from 'adm-zip';
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

/**
 * Packs the built extension in the dist/ folder into a .zip file
 * for uploading to the Chrome Web Store.
 */
async function pack() {
  const currentDir = import.meta.dir;
  const distPath = resolve(currentDir, '..', 'dist');
  const outPath = resolve(currentDir, '..', 'releases');

  if (!existsSync(outPath)) {
    mkdirSync(outPath);
  }

  const zip = new AdmZip();
  zip.addLocalFolder(distPath);

  const zipFileName = 'TabiNeko_Production.zip';
  zip.writeZip(resolve(outPath, zipFileName));

  console.log(`✓ Extension packed successfully: releases/${zipFileName}`);
}

pack();
