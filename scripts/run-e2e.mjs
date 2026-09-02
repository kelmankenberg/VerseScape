import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const playwrightArgs = process.argv.slice(2);
if (playwrightArgs[0] === '--') playwrightArgs.shift();
const runPlaywright = (environment) =>
  new Promise((resolve, reject) => {
    const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const playwright = spawn(command, ['exec', 'playwright', 'test', ...playwrightArgs], {
      stdio: 'inherit',
      env: environment,
    });
    playwright.once('error', reject);
    playwright.once('exit', (code, signal) => {
      if (signal) reject(new Error(`Playwright exited from signal ${signal}.`));
      else resolve(code ?? 1);
    });
  });

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForSocket(socketPath, compositor) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (compositor.exitCode !== null)
      throw new Error('Weston exited before its Wayland socket was ready.');
    try {
      await stat(socketPath);
      return;
    } catch {
      await sleep(20);
    }
  }
  throw new Error('Timed out waiting for Weston to create its Wayland socket.');
}

async function waitForXwaylandDisplay(logPath, compositor) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (compositor.exitCode !== null) throw new Error('Weston exited before Xwayland was ready.');
    try {
      const log = await readFile(logPath, 'utf8');
      const display = /xserver listening on display :(\d+)/.exec(log)?.[1];
      if (display) return `:${display}`;
    } catch {
      // Weston has not created the log file yet.
    }
    await sleep(20);
  }
  throw new Error('Timed out waiting for Weston to start its nested Xwayland server.');
}

async function runHeadlessLinuxTests() {
  const runtimeDirectory = await mkdtemp(join(tmpdir(), 'versescape-e2e-'));
  const socket = 'versescape-e2e';
  const logPath = join(runtimeDirectory, 'weston.log');
  const compositor = spawn(
    'weston',
    ['--backend=headless', `--socket=${socket}`, '--xwayland', `--log=${logPath}`],
    {
      env: { ...process.env, XDG_RUNTIME_DIR: runtimeDirectory },
      stdio: 'ignore',
    },
  );

  try {
    await waitForSocket(join(runtimeDirectory, socket), compositor);
    const display = await waitForXwaylandDisplay(logPath, compositor);
    return await runPlaywright({
      ...process.env,
      XDG_RUNTIME_DIR: runtimeDirectory,
      DISPLAY: display,
    });
  } finally {
    compositor.kill();
    await rm(runtimeDirectory, { recursive: true, force: true });
  }
}

const useExternalDisplay = process.env.CI || process.env.VERSESCAPE_E2E_DISPLAY === 'external';
const exitCode =
  process.platform === 'linux' && !useExternalDisplay
    ? await runHeadlessLinuxTests()
    : await runPlaywright(process.env);

process.exitCode = exitCode;
