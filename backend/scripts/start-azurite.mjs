// Starts Azurite only if none of its service ports are already in use.
// Prevents EADDRINUSE errors when npm run dev is called while Azurite is running.
import { createServer } from 'net';
import { spawn } from 'child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AZURITE_PORTS = [10000, 10001, 10002];
const AZURITE_LOCATION_ENV = 'FITTRACK_AZURITE_LOCATION';
const require = createRequire(import.meta.url);

export function getAzuriteLocation(environment = process.env, temporaryDirectory = tmpdir()) {
  const configuredLocation = environment[AZURITE_LOCATION_ENV]?.trim();
  return configuredLocation || join(temporaryDirectory, 'fittrack-azurite');
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.listen(port, '127.0.0.1');
    probe.on('listening', () => { probe.close(); resolve(false); });
    probe.on('error', () => resolve(true));
  });
}

async function main() {
  const portStates = await Promise.all(AZURITE_PORTS.map(isPortInUse));
  const occupiedPorts = AZURITE_PORTS.filter((_, index) => portStates[index]);

  if (occupiedPorts.length === AZURITE_PORTS.length) {
    console.log('[azurite] Already running — skipping start.');
    process.exit(0);
  }

  if (occupiedPorts.length > 0) {
    console.error(
      `[azurite] Cannot start because port(s) ${occupiedPorts.join(', ')} are already in use, ` +
        'but the other Azurite services are not listening. Stop the partial process and retry.',
    );
    process.exit(1);
  }

  const proc = spawn(
    process.execPath,
    [
      require.resolve('azurite/dist/src/azurite.js'),
      '--location',
      getAzuriteLocation(),
      '--silent',
      '--skipApiVersionCheck',
    ],
    { stdio: 'inherit' },
  );
  proc.on('error', (error) => {
    console.error(`[azurite] Failed to start: ${error.message}`);
    process.exit(1);
  });
  proc.on('exit', (code) => process.exit(code ?? 0));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
