import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('runtime configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('DEV', false);
    vi.stubGlobal('window', {
      location: { origin: 'https://fixture.azurestaticapps.net' },
      __APP_CONFIG__: {
        ENTRA_TENANT_ID: 'fixture-tenant',
        ENTRA_FRONTEND_CLIENT_ID: 'fixture-frontend',
        ENTRA_BACKEND_CLIENT_ID: 'fixture-backend',
        API_BASE_URL: '/api',
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('requires initialization before configuration access', async () => {
    const { getConfig, isConfigLoaded } = await import('./appConfig');
    expect(isConfigLoaded()).toBe(false);
    expect(() => getConfig()).toThrow('Configuration not loaded');
  });

  it('loads and caches the production inline configuration', async () => {
    const { loadConfig, getConfig } = await import('./appConfig');
    const loaded = await loadConfig();
    expect(loaded).toEqual({
      entraTenantId: 'fixture-tenant',
      entraFrontendClientId: 'fixture-frontend',
      entraBackendClientId: 'fixture-backend',
      apiBaseUrl: '/api',
      redirectUri: 'https://fixture.azurestaticapps.net',
    });
    expect(await loadConfig()).toBe(loaded);
    expect(getConfig()).toBe(loaded);
  });

  it('rejects placeholder backend configuration', async () => {
    window.__APP_CONFIG__!.ENTRA_BACKEND_CLIENT_ID = '<backend-client-id>';
    const { loadConfig } = await import('./appConfig');
    await expect(loadConfig()).rejects.toThrow('ENTRA_BACKEND_CLIENT_ID');
  });

  it('requests only the configured backend scope', async () => {
    const { loadConfig } = await import('./appConfig');
    await loadConfig();
    const { createApiRequest, createLoginRequest } = await import('./authConfig');
    expect(createApiRequest().scopes).toEqual(['api://fixture-backend/access_as_user']);
    expect(createLoginRequest().scopes).toContain('api://fixture-backend/access_as_user');
  });
});
