import AdmZip from 'adm-zip';
import { resolve } from 'path';
import { existsSync, mkdirSync, readFileSync } from 'fs';

interface PackageMeta {
  version: string;
}

async function pack() {
  const currentDir = import.meta.dir;
  const distPath = resolve(currentDir, '..', 'dist');
  const outPath = resolve(currentDir, '..', 'releases');
  const packageJsonPath = resolve(currentDir, '..', 'package.json');
  const packageMeta = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as PackageMeta;

  if (!existsSync(outPath)) {
    mkdirSync(outPath);
  }

  const zip = new AdmZip();
  zip.addLocalFolder(distPath);

  const zipFileName = `tabineko-v${packageMeta.version}.zip`;
  zip.writeZip(resolve(outPath, zipFileName));

  console.log(`✓ Extension packed successfully: releases/${zipFileName}`);
}

void pack();
