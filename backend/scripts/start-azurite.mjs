// Starts Azurite only if it is not already listening on its queue port (10001).
// Prevents EADDRINUSE errors when npm run dev is called while Azurite is running.
import { createServer } from 'net';
import { spawn } from 'child_process';

const AZURITE_QUEUE_PORT = 10001;

function isPortInUse(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.listen(port, '127.0.0.1');
    probe.on('listening', () => { probe.close(); resolve(false); });
    probe.on('error', () => resolve(true));
  });
}

if (await isPortInUse(AZURITE_QUEUE_PORT)) {
  console.log('[azurite] Already running — skipping start.');
  process.exit(0);
}

const proc = spawn(
  'azurite',
  ['--location', '.azurite', '--silent', '--skipApiVersionCheck'],
  { stdio: 'inherit', shell: true },
);
proc.on('exit', (code) => process.exit(code ?? 0));
