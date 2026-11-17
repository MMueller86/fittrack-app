// Unit tests for the one-time Cosmos setup in `getCosmos()`.
// The SDK is mocked; no network access.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  databaseCreateCalls: 0,
  containerCreateCalls: 0,
  containerRefCalls: 0,
  failDatabaseCreate: false,
  clientOptions: undefined as unknown,
}));

vi.mock('@azure/cosmos', () => {
  class CosmosClient {
    constructor(options: unknown) {
      sdk.clientOptions = options;
    }

    databases = {
      createIfNotExists: async () => {
        sdk.databaseCreateCalls += 1;
        if (sdk.failDatabaseCreate) throw new Error('boom');
        return {
          database: {
            containers: {
              createIfNotExists: async ({ id }: { id: string }) => {
                sdk.containerCreateCalls += 1;
                return { container: { id } };
              },
            },
          },
        };
      },
    };

    database() {
      return {
        container: (id: string) => {
          sdk.containerRefCalls += 1;
          return { id };
        },
      };
    }
  }
  return { CosmosClient };
});

import {
  __resetCosmosForTests,
  getCosmos,
  getCosmosInitDiagnostics,
  shouldProvisionSchema,
} from './cosmos';
import { CosmosTimingHttpClient } from './cosmosTiming';

const CONTAINER_COUNT = 12;

beforeEach(() => {
  vi.stubEnv('COSMOS_ENDPOINT', 'https://example.invalid');
  vi.stubEnv('COSMOS_KEY', 'test-key');
  vi.stubEnv('COSMOS_PROVISION_SCHEMA', '');
  vi.stubEnv('WEBSITE_SITE_NAME', '');
  sdk.databaseCreateCalls = 0;
  sdk.containerCreateCalls = 0;
  sdk.containerRefCalls = 0;
  sdk.failDatabaseCreate = false;
  __resetCosmosForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  __resetCosmosForTests();
});

describe('shouldProvisionSchema', () => {
  it('provisions by default outside Azure', () => {
    expect(shouldProvisionSchema()).toBe(true);
  });

  it('does not provision on an Azure-hosted Function App', () => {
    vi.stubEnv('WEBSITE_SITE_NAME', 'func-fittrack-alpha-wcobsd');
    expect(shouldProvisionSchema()).toBe(false);
  });

  it('lets COSMOS_PROVISION_SCHEMA override the default in both directions', () => {
    vi.stubEnv('WEBSITE_SITE_NAME', 'func-fittrack-alpha-wcobsd');
    vi.stubEnv('COSMOS_PROVISION_SCHEMA', 'true');
    expect(shouldProvisionSchema()).toBe(true);
    vi.stubEnv('WEBSITE_SITE_NAME', '');
    vi.stubEnv('COSMOS_PROVISION_SCHEMA', 'false');
    expect(shouldProvisionSchema()).toBe(false);
  });

  it.each([
    'https://localhost:8081',
    'http://127.0.0.1:18081',
    'http://host.docker.internal:8081',
  ])('always provisions against the local emulator endpoint %s', (endpoint) => {
    vi.stubEnv('COSMOS_ENDPOINT', endpoint);
    vi.stubEnv('WEBSITE_SITE_NAME', 'set-by-some-host');
    expect(shouldProvisionSchema()).toBe(true);
  });

  it('does not treat a remote account as an emulator', () => {
    vi.stubEnv('COSMOS_ENDPOINT', 'https://cosmos-fittrack-alpha-wcobsd.documents.azure.com:443/');
    vi.stubEnv('WEBSITE_SITE_NAME', 'func-fittrack-alpha-wcobsd');
    expect(shouldProvisionSchema()).toBe(false);
  });
});

describe('getCosmos', () => {
  it('passes the timing HTTP client to the Cosmos client', async () => {
    await getCosmos();

    expect((sdk.clientOptions as { httpClient?: unknown }).httpClient).toBeInstanceOf(CosmosTimingHttpClient);
  });
  it('creates the database and every container when provisioning is on', async () => {
    const ctx = await getCosmos();

    expect(sdk.databaseCreateCalls).toBe(1);
    expect(sdk.containerCreateCalls).toBe(CONTAINER_COUNT);
    expect(Object.keys(ctx.containers)).toHaveLength(CONTAINER_COUNT);
    expect(getCosmosInitDiagnostics()?.schemaProvisioned).toBe(true);
  });

  it('only builds local references, without creation calls, when provisioning is off', async () => {
    vi.stubEnv('WEBSITE_SITE_NAME', 'func-fittrack-alpha-wcobsd');

    const ctx = await getCosmos();

    expect(sdk.databaseCreateCalls).toBe(0);
    expect(sdk.containerCreateCalls).toBe(0);
    expect(sdk.containerRefCalls).toBe(CONTAINER_COUNT);
    expect(Object.keys(ctx.containers)).toHaveLength(CONTAINER_COUNT);
    expect(ctx.containers.weights).toEqual({ id: 'weights' });
    expect(getCosmosInitDiagnostics()?.schemaProvisioned).toBe(false);
  });

  it('records the setup duration and completion time', async () => {
    const before = performance.now();
    await getCosmos();

    const diagnostics = getCosmosInitDiagnostics();
    expect(diagnostics).toBeDefined();
    expect(diagnostics!.durationMs).toBeGreaterThanOrEqual(0);
    expect(diagnostics!.completedAtMonotonicMs).toBeGreaterThanOrEqual(before);
  });

  it('runs the setup once for concurrent callers', async () => {
    await Promise.all([getCosmos(), getCosmos(), getCosmos()]);

    expect(sdk.databaseCreateCalls).toBe(1);
    expect(sdk.containerCreateCalls).toBe(CONTAINER_COUNT);
  });

  it('does not cache a failed setup, so the next call retries', async () => {
    sdk.failDatabaseCreate = true;
    await expect(getCosmos()).rejects.toThrow('boom');
    expect(getCosmosInitDiagnostics()).toBeUndefined();

    sdk.failDatabaseCreate = false;
    await expect(getCosmos()).resolves.toBeDefined();
    expect(sdk.databaseCreateCalls).toBe(2);
  });
});
