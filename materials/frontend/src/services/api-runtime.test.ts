import axios, { AxiosAdapter, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../config/appConfig';

const fixture = vi.hoisted(() => {
  const config: AppConfig = {
    entraTenantId: 'fixture-tenant',
    entraFrontendClientId: 'fixture-frontend',
    entraBackendClientId: 'fixture-backend',
    apiBaseUrl: '/api',
    redirectUri: 'https://portal.example.invalid',
  };
  const account = {
    homeAccountId: 'fixture-account', localAccountId: 'fixture-local',
    environment: 'login.microsoftonline.com', tenantId: 'fixture-tenant',
    username: 'fixture@example.invalid',
  };
  return {
    config, account,
    msal: {
      getAllAccounts: vi.fn(() => [account]),
      getActiveAccount: vi.fn(() => account),
      acquireTokenSilent: vi.fn(async () => ({ accessToken: 'fixture-access-token' })),
    },
  };
});

vi.mock('../config/appConfig', () => ({ getConfig: () => fixture.config }));
vi.mock('../config/msalInstance', () => ({
  getMsalInitPromise: () => Promise.resolve(),
  getMsalInstance: () => fixture.msal,
}));

let requests: InternalAxiosRequestConfig[] = [];
const originalCreate = axios.create.bind(axios);
const transport: AxiosAdapter = async (config) => {
  requests.push(config);
  return {
    data: { posts: [], total: 0, page: 1, limit: 10, totalPages: 0 },
    status: 200, statusText: 'OK', headers: new AxiosHeaders(), config,
  };
};

function lastRequest(): InternalAxiosRequestConfig {
  const request = requests.at(-1);
  if (!request) throw new Error('Fixture transport did not receive a request');
  return request;
}

describe('runtime API endpoint and scoped token dispatch', () => {
  beforeEach(() => {
    requests = [];
    fixture.config.apiBaseUrl = '/api';
    vi.stubEnv('VITE_API_BASE_URL', 'https://stale-build.example.invalid');
    vi.stubGlobal('window', { location: { origin: 'https://portal.example.invalid' } });
    vi.spyOn(axios, 'create').mockImplementation((config) =>
      originalCreate({ ...config, adapter: transport }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('uses prepared runtime routing rather than a stale build-time API host', async () => {
    const { getPosts } = await import('./api');
    await getPosts();
    expect(requests).toHaveLength(1);
    expect(axios.getUri(lastRequest()))
      .toBe('https://portal.example.invalid/api/posts?page=1&limit=10');
  });

  it('joins API roots once while preserving development origins and custom prefixes', async () => {
    const { getPost } = await import('./api');
    const endpoints: [string, string][] = [
      ['/api/', 'https://portal.example.invalid/api/posts/'],
      ['http://localhost:8080', 'http://localhost:8080/api/posts/'],
      ['https://backend.example.invalid/api/', 'https://backend.example.invalid/api/posts/'],
      ['/gateway/api', 'https://portal.example.invalid/gateway/api/posts/'],
      ['https://api', 'https://api/api/posts/'],
    ];
    for (const [base, expected] of endpoints) {
      fixture.config.apiBaseUrl = base;
      await getPost('日本語/%記事');
      expect(axios.getUri(lastRequest()))
        .toBe(expected + encodeURIComponent('日本語/%記事'));
    }
  });

  it('sends a required token obtained for the configured backend, not the SPA', async () => {
    const { getMyPosts } = await import('./api');
    await getMyPosts();
    expect(fixture.msal.acquireTokenSilent).toHaveBeenCalledWith({
      scopes: ['api://fixture-backend/access_as_user'], account: fixture.account,
    });
    expect(lastRequest().headers.Authorization).toBe('Bearer fixture-access-token');
    expect(axios.getUri(lastRequest()))
      .toBe('https://portal.example.invalid/api/posts/my?page=1&limit=10');
  });

  it('rejects invalid or secret-bearing API base URLs before transport without echoing their values', async () => {
    const { getMyPosts } = await import('./api');
    for (const base of [
      'https://', 'javascript:private-fixture',
      'https://user:private-fixture@backend.example.invalid',
      'https://backend.example.invalid/api?token=private-fixture',
      'https://backend.example.invalid/api#private-fixture',
    ]) {
      fixture.config.apiBaseUrl = base;
      const result = getMyPosts();
      await expect(result).rejects.toThrow(/API base URL/);
      await expect(result).rejects.not.toThrow('private-fixture');
    }
    expect(requests).toHaveLength(0);
    expect(fixture.msal.acquireTokenSilent).not.toHaveBeenCalled();
  });
});
