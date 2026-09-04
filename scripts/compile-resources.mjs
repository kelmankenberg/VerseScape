import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import electron from 'electron';
import './build-compiler.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const compiler = join(root, 'packages', 'resource-compiler', 'dist', 'cli.cjs');
const requested = process.argv.slice(2).filter((argument) => argument !== '--');
const ids = requested.length > 0 ? requested : ['bsb', 'kjv', 'mhcc', 'jfb', 'tvtms', 'cross-references', 'tbesh', 'tbesg'];

for (const id of ids) {
  const isVersification = id === 'tvtms';
  const isCrossReferences = id === 'cross-references';
  const isLexicon = id === 'tbesh' || id === 'tbesg';
  const isCommentary = id === 'mhcc' || id === 'jfb';
  const source = isVersification
    ? join(root, 'resources', 'sources', id, 'tvtms.txt')
    : isCrossReferences
      ? join(root, 'resources', 'sources', id, 'data', 'cross_references.txt')
      : isLexicon
        ? join(root, 'resources', 'sources', id, `${id}.txt`)
      : isCommentary
        ? join(root, 'resources', 'sources', id, `${id}.epub`)
        : join(root, 'resources', 'sources', id, 'usfm');
  const output = join(root, 'resources', 'compiled', isVersification ? 'versification' : id);
  const recipe = join(root, 'resources', 'recipes', `${id}.json`);

  if (!existsSync(source)) {
    throw new Error(`Source files for ${id} are missing; run pnpm resources:fetch first.`);
  }
  await mkdir(output, { recursive: true });

  const args = isVersification
    ? [compiler, '--versification', source, output, recipe]
    : isCrossReferences
      ? [compiler, '--cross-references', source, output, recipe]
      : isLexicon
        ? [compiler, '--lexicon', source, output, recipe]
      : [compiler, source, output, recipe];

  if (isCommentary) {
    const entries = join(root, 'resources', 'sources', id, `${id}.entries.json`);
    const normalize = spawnSync(electron, [compiler, '--commentary-epub', source, entries], {
      cwd: root,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'inherit',
    });
    if (normalize.error) throw normalize.error;
    if (normalize.status !== 0) process.exit(normalize.status ?? 1);
    const result = spawnSync(electron, [compiler, '--commentary', entries, output, recipe], {
      cwd: root,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
    continue;
  }

  if (id === 'bsb') {
    const strongsTable = join(root, 'resources', 'sources', 'bsb', 'bsb_tables.tsv');
    if (existsSync(strongsTable)) {
      args.push('--strongs-table', strongsTable);
    }
  }

  const result = spawnSync(electron, args, {
    cwd: root,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
