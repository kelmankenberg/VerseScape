import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recipesDir = join(root, 'resources', 'recipes');
const sourcesDir = join(root, 'resources', 'sources');
const requested = process.argv.slice(2).filter((argument) => argument !== '--');
const ids = requested.length > 0 ? requested : ['bsb', 'kjv', 'mhcc', 'jfb', 'tvtms', 'cross-references', 'tbesh', 'tbesg'];

async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

for (const id of ids) {
  const recipePath = join(recipesDir, `${id}.json`);
  const recipe = JSON.parse(await readFile(recipePath, 'utf8'));
  const source = recipe.archive ?? recipe.file;
  if (!recipe.meta?.id || !source?.url || !source?.sha256) {
    throw new Error(`Invalid source recipe: ${recipePath}`);
  }

  const target = join(sourcesDir, id);
  const sourceName = recipe.file?.name ?? basename(new URL(source.url).pathname);
  const sourcePath = join(target, sourceName);
  const temporarySource = `${sourcePath}.download`;
  const unpacked = join(target, '.unpacked');
  const extracted = join(target, recipe.archive?.directory ?? 'usfm');

  await mkdir(target, { recursive: true });
  await rm(temporarySource, { force: true });
  console.log(`Fetching ${recipe.meta.title}...`);
  await download(source.url, temporarySource);

  const actual = createHash('sha256')
    .update(await readFile(temporarySource))
    .digest('hex');
  if (actual !== source.sha256) {
    await rm(temporarySource, { force: true });
    throw new Error(`Checksum mismatch for ${id}: expected ${source.sha256}, received ${actual}`);
  }

  await rename(temporarySource, sourcePath);
  if (recipe.file) {
    console.log(`Verified ${id} (${actual})`);
    continue;
  }

  await rm(unpacked, { recursive: true, force: true });
  await rm(extracted, { recursive: true, force: true });
  await mkdir(unpacked, { recursive: true });
  new AdmZip(sourcePath).extractAllTo(unpacked, true);

  const extractedRoot =
    recipe.archive.root === '.' ? unpacked : join(unpacked, recipe.archive.root);
  if (recipe.archive.root === '.') {
    await rename(unpacked, extracted);
  } else {
    await rename(extractedRoot, extracted);
    await rm(unpacked, { recursive: true, force: true });
  }

  console.log(`Verified ${id} (${actual})`);

  if (recipe.translationTable) {
    const table = recipe.translationTable;
    const tableName = table.name ?? basename(new URL(table.url).pathname);
    const tablePath = join(target, tableName);
    const temporaryTable = `${tablePath}.download`;

    await rm(temporaryTable, { force: true });
    console.log(`Fetching ${recipe.meta.title} translation table...`);
    await download(table.url, temporaryTable);

    const tableActual = createHash('sha256')
      .update(await readFile(temporaryTable))
      .digest('hex');
    if (tableActual !== table.sha256) {
      await rm(temporaryTable, { force: true });
      throw new Error(
        `Checksum mismatch for ${id} translation table: expected ${table.sha256}, received ${tableActual}`,
      );
    }

    await rename(temporaryTable, tablePath);
    console.log(`Verified ${id} translation table (${tableActual})`);
  }
}
