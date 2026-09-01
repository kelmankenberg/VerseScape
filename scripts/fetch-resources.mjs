import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recipesDir = join(root, 'resources', 'recipes');
const sourcesDir = join(root, 'resources', 'sources');
const requested = process.argv.slice(2).filter((argument) => argument !== '--');
const ids = requested.length > 0 ? requested : ['bsb', 'kjv'];

async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

for (const id of ids) {
  const recipePath = join(recipesDir, `${id}.json`);
  const recipe = JSON.parse(await readFile(recipePath, 'utf8'));
  if (recipe.meta?.id !== id || !recipe.archive?.url || !recipe.archive?.sha256) {
    throw new Error(`Invalid source recipe: ${recipePath}`);
  }

  const target = join(sourcesDir, id);
  const archive = join(target, basename(new URL(recipe.archive.url).pathname));
  const temporaryArchive = `${archive}.download`;
  const unpacked = join(target, '.unpacked');
  const usfm = join(target, 'usfm');

  await mkdir(target, { recursive: true });
  await rm(temporaryArchive, { force: true });
  console.log(`Fetching ${recipe.meta.title}...`);
  await download(recipe.archive.url, temporaryArchive);

  const actual = createHash('sha256')
    .update(await readFile(temporaryArchive))
    .digest('hex');
  if (actual !== recipe.archive.sha256) {
    await rm(temporaryArchive, { force: true });
    throw new Error(
      `Checksum mismatch for ${id}: expected ${recipe.archive.sha256}, received ${actual}`,
    );
  }

  await rename(temporaryArchive, archive);
  await rm(unpacked, { recursive: true, force: true });
  await rm(usfm, { recursive: true, force: true });
  await mkdir(unpacked, { recursive: true });
  new AdmZip(archive).extractAllTo(unpacked, true);

  const extractedRoot =
    recipe.archive.root === '.' ? unpacked : join(unpacked, recipe.archive.root);
  if (recipe.archive.root === '.') {
    await rename(unpacked, usfm);
  } else {
    await rename(extractedRoot, usfm);
    await rm(unpacked, { recursive: true, force: true });
  }

  console.log(`Verified ${id} (${actual})`);
}
