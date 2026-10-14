const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { inspectPublicApp, inspectSavedApp } = require('../check-workshop-app.cjs');
const values = { SWA_HOSTNAME: 'fixture.2.azurestaticapps.net',
  TENANT_ID: '00000000-0000-0000-0000-000000000002',
  FRONTEND_CLIENT_ID: '00000000-0000-0000-0000-000000000004',
  BACKEND_CLIENT_ID: '00000000-0000-0000-0000-000000000003' };
function fixture(overrides = {}) {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    if (overrides.transport) throw new Error('PRIVATE_TOKEN_FIXTURE');
    if (url.endsWith('/')) {
      return new Response(overrides.html || `<script>window.__APP_CONFIG__=${JSON.stringify({
        ENTRA_TENANT_ID: values.TENANT_ID, ENTRA_FRONTEND_CLIENT_ID: values.FRONTEND_CLIENT_ID,
        ENTRA_BACKEND_CLIENT_ID: values.BACKEND_CLIENT_ID, API_BASE_URL: '/api',
      })};</script>`, { headers: { 'content-type': 'text/html' } });
    }
    const body = url.includes('/posts') ? { posts: [], total: 0, page: 1, limit: 1, totalPages: 0,
      ...overrides.posts } : { status: overrides.health || 'healthy' };
    return new Response(overrides.body || JSON.stringify(body), {
      status: overrides.status || 200, headers: { 'content-type': overrides.type || 'application/json' },
    });
  };
  return { request, calls };
}

test('public smoke verifies five actual contracts but never claims authenticated/release/recovery completion', async () => {
  const { request, calls } = fixture();
  const report = await inspectPublicApp(values, 'fixture-hash.japaneast.azurewebsites.net', request);
  assert.equal(report.status, 'public_checks_passed');
  assert.equal(report.workshopReady, false);
  assert.equal(report.checks.length, 5);
  assert(report.notVerified.includes('authenticated CRUD'));
  assert.equal(calls.length, 5);
  assert(calls.every((call) => call.options.method === 'GET' && call.options.redirect === 'manual' &&
    call.options.signal instanceof AbortSignal && !call.options.headers.Authorization));
  assert(calls.every((call) => !call.url.includes('/posts/')));
});

test('published Unicode slugs are data; public probes do not increment article view counters', async () => {
  const { request, calls } = fixture({ posts: { posts: [{ status: 'published', slug: '日本語の投稿' }], total: 1, totalPages: 1 } });
  const report = await inspectPublicApp(values, 'fixture.azurewebsites.net', request);
  assert.equal(report.checks[2].publishedCount, 1);
  assert(calls.every((call) => !call.url.includes('日本語')));
});

test('HTTP/auth, unhealthy, HTML, invalid JSON, pagination and wrong config fail without echoing private bodies', async () => {
  for (const overrides of [{ status: 401 }, { status: 503 }, { health: 'unhealthy' },
    { type: 'text/html' }, { body: 'PRIVATE_TOKEN_FIXTURE' }, { transport: true },
    { posts: { total: -1 } }, { posts: { total: 1, totalPages: 1 } },
    { posts: { posts: [{ status: 'draft', slug: 'draft' }] } },
    { html: '<script>window.__APP_CONFIG__=null;</script>' },
    { html: '<script>window.__APP_CONFIG__={"ENTRA_TENANT_ID":"PRIVATE_TOKEN_FIXTURE"};</script>' }]) {
    const { request } = fixture(overrides);
    await assert.rejects(() => inspectPublicApp(values, 'fixture.azurewebsites.net', request),
      (error) => !error.message.includes('PRIVATE_TOKEN_FIXTURE'));
  }
});

test('unsafe destinations and oversized responses stop explicitly', async () => {
  const { request } = fixture();
  await assert.rejects(() => inspectPublicApp(values, 'fixture.example.invalid', request), /hostname/);
  const large = fixture({ body: 'x'.repeat(1048577) });
  await assert.rejects(() => inspectPublicApp(values, 'fixture.azurewebsites.net', large.request), /1 MiB/);
  const empty = JSON.stringify({ status: 'healthy', padding: '' });
  const exact = JSON.stringify({ status: 'healthy', padding: 'x'.repeat(1048576 - Buffer.byteLength(empty)) });
  assert.equal(Buffer.byteLength(exact), 1048576);
  const bounded = async (url, options) => url.endsWith('/health')
    ? new Response(exact, { headers: { 'content-type': 'application/json' } }) : request(url, options);
  assert.equal((await inspectPublicApp(values, 'fixture.azurewebsites.net', bounded)).status, 'public_checks_passed');
});

test('saved state scopes resource lookups and blocks context/target mismatch before HTTP', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'paas-public-state-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  const state = { ...values, WORKSHOP_REPO_DIR: path.resolve(__dirname, '../..'),
    WORKSHOP_STATE_DIR: directory, PARAM_FILE: path.join(directory, 'dev.local.bicepparam'),
    SUBSCRIPTION_ID: '00000000-0000-0000-0000-000000000001',
    ACCESS_SCOPE_ID: '00000000-0000-0000-0000-000000000005',
    LOCATION: 'japaneast', SWA_LOCATION: 'eastasia', BASE_NAME: 'blogapp', GROUP_ID: 'B',
    RESOURCE_GROUP: 'rg-fixture-B-paas-workshop', APP_SERVICE_NAME: 'app-fixture', SWA_NAME: 'swa-fixture' };
  fs.writeFileSync(path.join(directory, 'paas-workshop.json'), JSON.stringify({ version: 1, values: state }));
  for (const scenario of ['', 'context', 'target']) {
    const metadataCalls = [];
    const invoke = (args) => {
      metadataCalls.push(args);
      if (args[0] === 'account') return { id: state.SUBSCRIPTION_ID,
        tenantId: scenario === 'context' ? state.SUBSCRIPTION_ID : state.TENANT_ID,
        state: 'Enabled', environmentName: 'AzureCloud' };
      if (args[0] === 'webapp') return 'fixture.azurewebsites.net';
      return scenario === 'target' ? 'other.azurestaticapps.net' : state.SWA_HOSTNAME;
    };
    const { request, calls } = fixture();
    if (scenario) {
      await assert.rejects(() => inspectSavedApp(directory, invoke, request), /match|differs/);
      assert.equal(calls.length, 0);
      if (scenario === 'context') assert.equal(metadataCalls.length, 1);
    } else {
      assert.equal((await inspectSavedApp(directory, invoke, request)).workshopReady, false);
      for (const args of metadataCalls.slice(1)) {
        assert.equal(args[args.indexOf('--subscription') + 1], state.SUBSCRIPTION_ID);
        assert.equal(args[args.indexOf('--resource-group') + 1], state.RESOURCE_GROUP);
      }
    }
  }
});
