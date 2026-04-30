// Wait for the Cosmos DB Emulator to accept SDK requests.
//
// Why this exists as a Node script (not curl):
//   - curl uses a different TLS stack than Node. A green curl probe does
//     NOT prove that `@azure/cosmos` (which uses undici) can connect.
//   - We had a CI false-positive where curl reported "ready" but Vitest
//     immediately got `fetch failed`.
//   - Probing via Node + fetch means: if this script exits 0, the SDK
//     will be able to reach the emulator too.
//
// Exits 0 once the emulator responds to a real HTTPS request, 1 on
// timeout. Used by `.github/workflows/ci.yml`.

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// vnext-preview Linux emulator listens on plain HTTP. See cosmosEmulator.ts.
const ENDPOINT = process.env.COSMOS_ENDPOINT ?? 'http://127.0.0.1:8081';
const MAX_ATTEMPTS = 90;
const DELAY_MS = 2_000;

async function probe(attempt) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 3_000);
  try {
    const res = await fetch(ENDPOINT, {
      // Send a master-key auth header. Cosmos returns 400/401 for invalid
      // signatures, which still proves the data plane is up.
      headers: { Authorization: 'type=master&ver=1.0&sig=' },
      signal: ac.signal,
    });
    console.log(`Attempt ${attempt}: HTTP ${res.status} from ${ENDPOINT}`);
    // Anything that round-trips means the emulator is serving requests.
    // 503 = still warming up, treat as not-ready.
    return res.status !== 503;
  } catch (err) {
    console.log(`Attempt ${attempt}: ${err?.cause?.code ?? err.message}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    if (await probe(i)) {
      console.log(`Cosmos Emulator is ready at ${ENDPOINT}.`);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  console.error(
    `::error::Cosmos Emulator did not become ready at ${ENDPOINT} ` +
      `after ${MAX_ATTEMPTS} attempts (~${(MAX_ATTEMPTS * DELAY_MS) / 1000}s).`,
  );
  process.exit(1);
})();
