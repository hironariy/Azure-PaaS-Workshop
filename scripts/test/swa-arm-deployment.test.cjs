const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { createHash } = require('node:crypto');
const http = require('node:http');
const { configureFrontend } = require('../configure-frontend.cjs');
const { prepareRelease, verifyRelease, deployHostedRelease, deploySavedRelease } = require('../deploy-swa-arm.cjs');

const repository = path.resolve(__dirname, '../..');
const values = {
  SUBSCRIPTION_ID: '00000000-0000-0000-0000-000000000001',
  TENANT_ID: '00000000-0000-0000-0000-000000000002',
  FRONTEND_CLIENT_ID: '00000000-0000-0000-0000-000000000003',
  BACKEND_CLIENT_ID: '00000000-0000-0000-0000-000000000004',
  ACCESS_SCOPE_ID: '00000000-0000-0000-0000-000000000005',
  RESOURCE_GROUP: 'rg-blogapp-B-paas-workshop', SWA_NAME: 'swa-fixture',
  SWA_HOSTNAME: 'fixture.azurestaticapps.net', APP_SERVICE_NAME: 'app-fixture',
  BASE_NAME: 'blogapp', GROUP_ID: 'B', LOCATION: 'japaneast', SWA_LOCATION: 'eastasia',
  WORKSHOP_REPO_DIR: repository,
};
const secret = 'PRIVATE_ARTIFACT_FIXTURE';
const hostedUrl = `https://owned.example.invalid/frontend.zip?sig=${secret}`;
const token = 'PRIVATE_ARM_TOKEN_FIXTURE';
const bytes = Buffer.from('owned fixture ZIP contents');
const receipt = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
const operation = `https://management.azure.com/subscriptions/${values.SUBSCRIPTION_ID}/providers/Microsoft.Web/locations/eastasia/operationResults/11111111-1111-1111-1111-111111111111?api-version=2019-01-01`;
function json(status, body, headers = {}) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}

function transport(responses) {
  const calls = [];
  let time = 0, tokens = 0;
  const options = {
    now: () => time,
    wait: async (milliseconds) => { time += milliseconds; },
    getToken: () => { tokens++; return token; },
    request: async (url, init) => {
      calls.push({ url, init });
      const next = responses.shift();
      if (next instanceof Error) throw next;
      assert(next, 'Unexpected fixture request');
      return typeof next === 'function' ? next() : next;
    },
  };
  return { options, calls, tokens: () => tokens, advance: (ms) => { time += ms; } };
}

function packageFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paas-arm-release-'));
  t.after(() => fs.rmSync(root, { recursive: true }));
  const dist = path.join(root, 'dist');
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), '<script>window.__APP_CONFIG__=null;</script>');
  fs.writeFileSync(path.join(dist, 'assets/main.js'), 'fixture release assets');
  fs.copyFileSync(path.join(repository, 'materials/frontend/staticwebapp.config.json'),
    path.join(dist, 'staticwebapp.config.json'));
  configureFrontend(dist, { ENTRA_TENANT_ID: values.TENANT_ID,
    ENTRA_FRONTEND_CLIENT_ID: values.FRONTEND_CLIENT_ID,
    ENTRA_BACKEND_CLIENT_ID: values.BACKEND_CLIENT_ID });
  const archive = path.join(root, 'frontend.zip');
  const saved = { ...values, WORKSHOP_STATE_DIR: root, PARAM_FILE: path.join(root, 'dev.local.bicepparam') };
  fs.writeFileSync(path.join(root, 'paas-workshop.json'), JSON.stringify({ version: 1, values: saved }));
  return { root, dist, archive, saved };
}

test('prepared ZIP has root runtime/routing/assets, private receipt and source provenance; never overwrites', (t) => {
  const { archive, dist, saved } = packageFixture(t);
  const prepared = prepareRelease(dist, archive, saved);
  assert.equal(prepared.version, 1);
  assert.match(prepared.sourceRevision, /^[a-f0-9]{40}$/);
  assert.equal(typeof prepared.sourceDirty, 'boolean');
  assert.equal(fs.statSync(archive).mode & 0o777, 0o600);
  assert.equal(fs.statSync(`${archive}.json`).mode & 0o777, 0o600);
  assert.deepEqual(verifyRelease(archive, saved), prepared);
  const contents = fs.readFileSync(archive);
  assert.throws(() => prepareRelease(dist, archive, saved), /already exists/);
  assert.deepEqual(fs.readFileSync(archive), contents);
  assert.equal(fs.readdirSync(path.dirname(archive)).some((file) => file.startsWith('.swa-package-')), false);
});

test('artifact target changes, corrupted receipt/archive, symlinks and unsafe dist files fail closed', (t) => {
  const { archive, dist, saved } = packageFixture(t);
  prepareRelease(dist, archive, saved);
  assert.throws(() => verifyRelease(archive, { ...saved, SWA_NAME: 'swa-other' }), /does not match/);
  const receiptFile = fs.readFileSync(`${archive}.json`);
  fs.writeFileSync(`${archive}.json`, '{"version":2}');
  assert.throws(() => verifyRelease(archive, saved), /does not match/);
  fs.writeFileSync(`${archive}.json`, receiptFile);
  const original = fs.readFileSync(archive);
  fs.appendFileSync(archive, 'bad');
  assert.throws(() => verifyRelease(archive, saved), /does not match/);
  fs.writeFileSync(archive, original);
  const link = path.join(path.dirname(archive), 'linked.zip');
  fs.symlinkSync(archive, link);
  assert.throws(() => verifyRelease(link, saved), /regular file/);
  fs.symlinkSync(archive, path.join(dist, 'unsafe.zip'));
  assert.throws(() => prepareRelease(dist, path.join(path.dirname(archive), 'another.zip'), saved), /unsafe artifact/);
});

test('wrong runtime identities and missing routing fail before ZIP creation', (t) => {
  const { archive, dist, saved } = packageFixture(t);
  fs.writeFileSync(path.join(dist, 'staticwebapp.config.json'), '{}');
  assert.throws(() => prepareRelease(dist, archive, saved), /routing differ/);
  assert.equal(fs.existsSync(archive), false);
});

test('ARM receives documented appZipUrl only after exact hosted checksum; OAuth never goes to the host', async () => {
  const fixture = transport([new Response(bytes), json(200, null)]);
  const report = await deployHostedRelease(values, receipt, hostedUrl, fixture.options);
  assert.equal(report.status, 'arm_completed');
  assert.equal(report.workshopReady, false);
  assert.equal(fixture.tokens(), 1);
  assert.equal(fixture.calls[0].init.headers, undefined);
  const post = fixture.calls[1];
  assert.equal(post.init.method, 'POST');
  assert.equal(post.init.headers.Authorization, `Bearer ${token}`);
  assert.deepEqual(JSON.parse(post.init.body), { properties: {
    appZipUrl: hostedUrl, provider: 'Azure-PaaS-Workshop',
  } });
  assert(post.url.endsWith('/staticSites/swa-fixture/zipdeploy?api-version=2025-05-01'));
  assert(fixture.calls.every((call) => call.init.redirect === 'manual' && call.init.signal));
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_ARTIFACT|PRIVATE_ARM/);
});

test('native fetch sends the real JSON envelope and follows no hosted redirects on a loopback fixture', async (t) => {
  const calls = [];
  let redirectHost = false;
  const server = http.createServer((request, response) => {
    const parts = [];
    request.on('data', (part) => parts.push(part));
    request.on('end', () => {
      calls.push({ path: request.url, authorization: request.headers.authorization,
        method: request.method, body: Buffer.concat(parts).toString('utf8') });
      if (request.url === '/artifact') {
        if (redirectHost) {
          response.writeHead(302, { location: '/must-not-follow' });
          response.end();
        } else response.end(bytes);
      } else if (request.url === '/submit') {
        response.writeHead(202, { 'azure-asyncoperation': operation, 'retry-after': '0' });
        response.end();
      } else if (request.url === '/poll') {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ status: 'Succeeded' }));
      } else {
        response.writeHead(500);
        response.end();
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const address = server.address();
  const request = (destination, init) => {
    const route = destination === hostedUrl ? '/artifact' : init.method === 'POST' ? '/submit' : '/poll';
    return fetch(`http://127.0.0.1:${address.port}${route}`, init);
  };
  const result = await deployHostedRelease(values, receipt, hostedUrl, { request, getToken: () => token });
  assert.equal(result.polls, 1);
  assert.deepEqual(calls.map((call) => call.path), ['/artifact', '/submit', '/poll']);
  assert.equal(calls[0].authorization, undefined);
  assert.equal(calls[1].authorization, `Bearer ${token}`);
  assert.equal(JSON.parse(calls[1].body).properties.appZipUrl, hostedUrl);
  redirectHost = true;
  const before = calls.length;
  await assert.rejects(deployHostedRelease(values, receipt, hostedUrl, { request, getToken: () => token }), /HTTP 302/);
  assert.equal(calls.length, before + 1);
});

test('malformed/secret-bearing unsupported URLs, oversized ZIPs and host redirects never acquire an ARM token', async () => {
  for (const url of ['http://owned.example.invalid/a', `https://${secret}@owned.example.invalid/a`,
    `https://owned.example.invalid/a#${secret}`, `https://${secret}`, 'https://127.0.0.1/a',
    `https://owned.example.invalid/a\n${secret}`]) {
    const fixture = transport([]);
    await assert.rejects(deployHostedRelease(values, receipt, url, fixture.options),
      (error) => !error.message.includes(secret));
    assert.equal(fixture.calls.length, 0);
    assert.equal(fixture.tokens(), 0);
  }
  for (const response of [new Response(bytes, { status: 302, headers: { location: hostedUrl } }),
    new Response(Buffer.from('wrong')), new Response(Buffer.alloc(bytes.length + 1))]) {
    const fixture = transport([response]);
    await assert.rejects(deployHostedRelease(values, receipt, hostedUrl, fixture.options),
      (error) => !error.message.includes(secret));
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.tokens(), 0);
  }
  const oversized = transport([]);
  await assert.rejects(deployHostedRelease(values, { ...receipt, bytes: 50 * 1024 * 1024 + 1 },
    hostedUrl, oversized.options), /checksum\/size/);
  assert.equal(oversized.calls.length, 0);
});

test('202 is not success: follow trusted async operation until terminal Succeeded with Retry-After', async () => {
  const fixture = transport([new Response(bytes),
    json(202, null, { 'azure-asyncoperation': operation, 'retry-after': '2' }),
    json(200, { status: 'InProgress' }, { 'retry-after': '1' }),
    json(200, { status: 'Succeeded' })]);
  const report = await deployHostedRelease(values, receipt, hostedUrl, fixture.options);
  assert.equal(report.polls, 2);
  assert.equal(fixture.calls.length, 4);
  assert.equal(fixture.calls[2].url, operation);
  assert.equal(fixture.calls[2].init.headers.Authorization, `Bearer ${token}`);
  assert.equal(fixture.options.now(), 3000);
});

test('documented Location completion permits an empty HTTP 200, not a bare 202', async () => {
  const fixture = transport([new Response(bytes), json(202, null, { location: operation, 'retry-after': '0' }),
    json(202, null, { 'retry-after': '0' }), json(200, null)]);
  const report = await deployHostedRelease(values, receipt, hostedUrl, fixture.options);
  assert.equal(report.polls, 2);
});

test('missing, foreign, redirected, credential-bearing and cross-subscription polling destinations are rejected', async () => {
  for (const location of ['', operation.replace(values.SUBSCRIPTION_ID, values.TENANT_ID),
    operation.replace('management.azure.com', 'foreign.example.invalid'),
    operation.replace('/operationResults/', '/notAnOperation/'), `${operation}&sig=${secret}`,
    operation.replace('https://', `https://${secret}@`)]) {
    const fixture = transport([new Response(bytes), json(202, null,
      location ? { 'azure-asyncoperation': location } : {})]);
    await assert.rejects(deployHostedRelease(values, receipt, hostedUrl, fixture.options),
      (error) => /polling|destination/.test(error.message) && !error.message.includes(secret));
    assert.equal(fixture.calls.length, 2);
  }
});

test('ARM failure/cancellation, unknown state, HTTP denial and malformed JSON cannot become success or echo response secrets', async () => {
  for (const response of [json(200, { status: 'Failed', error: { message: secret } }),
    json(200, { status: 'Canceled', error: { message: secret } }),
    json(200, { status: 'Unknown', message: secret }), json(403, { message: secret }),
    new Response(secret, { status: 200 }), json(200, null)]) {
    const fixture = transport([new Response(bytes),
      json(202, null, { 'azure-asyncoperation': operation, 'retry-after': '0' }), response]);
    await assert.rejects(deployHostedRelease(values, receipt, hostedUrl, fixture.options),
      (error) => !error.message.includes(secret));
  }
});

test('polling is bounded by 120 attempts and total deadline; invalid Retry-After fails explicitly', async () => {
  const fixture = transport([new Response(bytes),
    json(202, null, { 'azure-asyncoperation': operation, 'retry-after': '0' }),
    ...Array.from({ length: 120 }, () => json(200, { status: 'Running' }, { 'retry-after': '0' }))]);
  await assert.rejects(deployHostedRelease(values, receipt, hostedUrl, fixture.options), /120 attempts/);
  assert.equal(fixture.calls.length, 122);
  const timed = transport([new Response(bytes),
    () => { timed.advance(899999); return json(202, null, { location: operation }); }]);
  await assert.rejects(deployHostedRelease(values, receipt, hostedUrl, timed.options), /timed out/);
  assert.equal(timed.calls.length, 2);
  const invalid = transport([new Response(bytes), json(202, null,
    { location: operation, 'retry-after': secret })]);
  await assert.rejects(deployHostedRelease(values, receipt, hostedUrl, invalid.options),
    (error) => /Retry-After/.test(error.message) && !error.message.includes(secret));
});

test('transport, token and reflected ARM errors are sanitized and never retry the POST', async () => {
  for (const replies of [[new Error(secret)], [new Response(bytes), new Error(secret)],
    [new Response(bytes), json(400, { message: secret })]]) {
    const fixture = transport(replies);
    await assert.rejects(deployHostedRelease(values, receipt, hostedUrl, fixture.options),
      (error) => !error.message.includes(secret));
    assert(fixture.calls.filter((call) => call.init.method === 'POST').length <= 1);
  }
});

test('saved deployment verifies exact index and public readiness, not just accepted ARM upload', async (t) => {
  const { root, archive, dist, saved } = packageFixture(t);
  prepareRelease(dist, archive, saved);
  const contents = fs.readFileSync(archive);
  let checked = false;
  const fixture = transport([new Response(contents), json(200, null),
    new Response(fs.readFileSync(path.join(dist, 'index.html')), { headers: { 'content-type': 'text/html' } })]);
  const report = await deploySavedRelease(root, archive, hostedUrl, {
    ...fixture.options,
    loadTargets: () => ({ values: saved, appHostname: 'fixture.azurewebsites.net' }),
    inspect: async () => { checked = true; return { checks: [{ check: 'public fixture', passed: true }] }; },
  });
  assert(checked);
  assert.equal(report.status, 'arm_release_public_checks_passed');
  assert.equal(report.workshopReady, false);
  assert.equal(report.notVerified.includes('owned artifact cleanup'), true);
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_ARTIFACT|PRIVATE_ARM/);
});

test('old HTML or failed public readiness after ARM completion never reports a completed release', async (t) => {
  for (const failHealth of [false, true]) {
    const { root, archive, dist, saved } = packageFixture(t);
    prepareRelease(dist, archive, saved);
    const responses = [new Response(fs.readFileSync(archive)), json(200, null)];
    if (!failHealth) responses.push(...Array.from({ length: 6 }, () =>
      new Response('<h1>old release</h1>', { headers: { 'content-type': 'text/html' } })));
    const fixture = transport(responses);
    let probes = 0;
    await assert.rejects(deploySavedRelease(root, archive, hostedUrl, {
      ...fixture.options,
      loadTargets: () => ({ values: saved, appHostname: 'fixture.azurewebsites.net' }),
      inspect: async () => {
        probes++;
        if (failHealth) throw new Error('direct-health: expected status=healthy');
        return { checks: [] };
      },
    }), /ARM completed but release\/public readiness is unverified/);
    assert.equal(probes, 6);
    assert.equal(fixture.calls.filter((call) => call.init.method === 'POST').length, 1);
  }
});

test('a changed saved target is rejected before hosted fetch or token acquisition', async (t) => {
  const { root, archive, dist, saved } = packageFixture(t);
  prepareRelease(dist, archive, saved);
  const fixture = transport([]);
  await assert.rejects(deploySavedRelease(root, archive, hostedUrl, {
    ...fixture.options,
    loadTargets: () => ({ values: { ...saved, SWA_NAME: 'swa-other' }, appHostname: 'fixture.azurewebsites.net' }),
  }), /changed during deployment validation/);
  assert.equal(fixture.calls.length, 0);
});

test('real Azure CLI token boundary rejects wrong tenants and suppresses reflective CLI errors', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'paas-arm-token-'));
  const previous = process.env.PATH;
  t.after(() => { process.env.PATH = previous; fs.rmSync(directory, { recursive: true }); });
  process.env.PATH = `${directory}${path.delimiter}${previous}`;
  for (const script of [
    `console.error('${secret}'); process.exit(9);`,
    `console.log(JSON.stringify({subscription:'${values.SUBSCRIPTION_ID}',tenant:'${values.FRONTEND_CLIENT_ID}',accessToken:'${token}'}));`,
  ]) {
    fs.writeFileSync(path.join(directory, 'az'), `#!${process.execPath}\n${script}\n`, { mode: 0o755 });
    const fixture = transport([new Response(bytes)]);
    const options = { ...fixture.options };
    delete options.getToken;
    await assert.rejects(deployHostedRelease(values, receipt, hostedUrl, options),
      (error) => !error.message.includes(secret) && !error.message.includes(token));
    assert.equal(fixture.calls.length, 1);
  }
});

test('deploy CLI refuses URL arguments and never echoes them; prepare CLI returns an undeployed receipt', (t) => {
  const { root, archive, dist } = packageFixture(t);
  const helper = path.join(repository, 'scripts/deploy-swa-arm.cjs');
  const bad = spawnSync(process.execPath, [helper, 'deploy', root, archive, hostedUrl], { encoding: 'utf8' });
  assert.notEqual(bad.status, 0);
  assert.doesNotMatch(bad.stdout + bad.stderr, /PRIVATE_ARTIFACT/);
  const prepared = spawnSync(process.execPath, [helper, 'prepare', root, dist, archive], { encoding: 'utf8' });
  assert.equal(prepared.status, 0, prepared.stderr);
  assert.equal(JSON.parse(prepared.stdout).status, 'prepared_not_deployed');
});
