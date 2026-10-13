#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { readState } = require('./workshop-state.cjs');
const { loadAppTargets, inspectPublicApp, readResponse } = require('./check-workshop-app.cjs');

const ARM = 'https://management.azure.com';
const API = '2025-05-01';
const MAX_ZIP = 50 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function command(tool, args, options = {}) {
  const result = spawnSync(tool, args, {
    encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'], ...options,
  });
  if (result.error || result.status !== 0) throw new Error(`${tool} command failed or timed out; output withheld`);
  return result.stdout;
}

function digest(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function regularFile(file, limit) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    throw new Error('Required artifact file is not readable');
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0 || stat.size > limit) {
    throw new Error('Artifact must be a nonempty regular file within its size limit');
  }
  return stat;
}

function identity(values) {
  for (const key of ['SUBSCRIPTION_ID', 'TENANT_ID', 'FRONTEND_CLIENT_ID', 'BACKEND_CLIENT_ID']) {
    if (!UUID.test(values[key] || '')) throw new Error('Invalid saved artifact identity');
  }
  if (!/^[a-z0-9_().-]{1,90}$/i.test(values.RESOURCE_GROUP || '') ||
      values.RESOURCE_GROUP.endsWith('.') || !/^[a-z0-9-]{1,60}$/i.test(values.SWA_NAME || '')) {
    throw new Error('Invalid saved ARM resource target');
  }
  return {
    subscription: values.SUBSCRIPTION_ID, tenant: values.TENANT_ID,
    group: values.RESOURCE_GROUP, site: values.SWA_NAME,
    frontend: values.FRONTEND_CLIENT_ID, backend: values.BACKEND_CLIENT_ID,
  };
}

function verifyConfig(html, routing, values) {
  const matches = [...html.matchAll(/window\.__APP_CONFIG__\s*=\s*(\{[^<]*?\})\s*;/g)];
  let config, routes;
  try {
    if (matches.length !== 1) throw new Error();
    config = JSON.parse(matches[0][1]);
    routes = JSON.parse(routing);
  } catch {
    throw new Error('Prepared ZIP is missing valid runtime/routing JSON');
  }
  if (!config || !routes || config.ENTRA_TENANT_ID !== values.TENANT_ID ||
      config.ENTRA_FRONTEND_CLIENT_ID !== values.FRONTEND_CLIENT_ID ||
      config.ENTRA_BACKEND_CLIENT_ID !== values.BACKEND_CLIENT_ID ||
      config.API_BASE_URL !== '/api' || Object.keys(config).length !== 4 ||
      routes.navigationFallback?.rewrite !== '/index.html' ||
      !Array.isArray(routes.routes) || !routes.routes.some((route) =>
        route?.route === '/api/*' && Array.isArray(route.allowedRoles) && route.allowedRoles.includes('anonymous'))) {
    throw new Error('Prepared ZIP runtime identities or routing differ from the workshop contract');
  }
}

function prepareRelease(directory, archive, values) {
  const target = identity(values);
  if (!path.isAbsolute(archive) || !archive.endsWith('.zip')) throw new Error('Supply an absolute new .zip path');
  if (fs.existsSync(archive) || fs.existsSync(`${archive}.json`)) throw new Error('Artifact already exists');
  const files = [];
  function visit(current, prefix = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const name = prefix + entry.name;
      if (entry.isSymbolicLink() || entry.name.startsWith('.') || /[\r\n\\]/.test(name)) {
        throw new Error('Prepared output contains an unsafe artifact entry');
      }
      if (entry.isDirectory()) visit(path.join(current, entry.name), `${name}/`);
      else if (entry.isFile()) files.push(name);
      else throw new Error('Prepared output contains a nonregular entry');
    }
  }
  visit(directory);
  if (!files.includes('index.html') || !files.includes('staticwebapp.config.json') ||
      !files.some((file) => file.startsWith('assets/'))) throw new Error('Frontend output is incomplete');
  verifyConfig(fs.readFileSync(path.join(directory, 'index.html'), 'utf8'),
    fs.readFileSync(path.join(directory, 'staticwebapp.config.json'), 'utf8'), values);
  const sourceRevision = command('git', ['-C', values.WORKSHOP_REPO_DIR, 'rev-parse', 'HEAD']).trim();
  if (!/^[a-f0-9]{40}$/.test(sourceRevision)) throw new Error('Invalid source revision');
  const sourceDirty = command('git', ['-C', values.WORKSHOP_REPO_DIR, 'status', '--porcelain']).trim().length > 0;
  const temporary = fs.mkdtempSync(path.join(path.dirname(archive), '.swa-package-'));
  let archiveCreated = false;
  try {
    const packaged = path.join(temporary, 'frontend.zip');
    command('zip', ['-q', '-r', packaged, '.'], { cwd: directory });
    command('unzip', ['-t', packaged]);
    regularFile(packaged, MAX_ZIP);
    const contents = fs.readFileSync(packaged);
    const receipt = { version: 1, target, sourceRevision, sourceDirty,
      sha256: digest(contents), bytes: contents.length, createdAt: new Date().toISOString() };
    fs.writeFileSync(archive, contents, { flag: 'wx', mode: 0o600 });
    archiveCreated = true;
    fs.writeFileSync(`${archive}.json`, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return receipt;
  } catch (error) {
    if (archiveCreated) fs.unlinkSync(archive);
    throw error;
  } finally {
    fs.rmSync(temporary, { recursive: true });
  }
}

function verifyRelease(archive, values) {
  regularFile(archive, MAX_ZIP);
  regularFile(`${archive}.json`, 16384);
  let receipt;
  try {
    receipt = JSON.parse(fs.readFileSync(`${archive}.json`, 'utf8'));
  } catch {
    throw new Error('Invalid artifact receipt');
  }
  const target = identity(values);
  if (receipt.version !== 1 || Object.keys(target).some((key) => receipt.target?.[key] !== target[key]) ||
      !/^[a-f0-9]{40}$/.test(receipt.sourceRevision || '') || typeof receipt.sourceDirty !== 'boolean' ||
      !/^[a-f0-9]{64}$/.test(receipt.sha256 || '') ||
      receipt.bytes !== fs.statSync(archive).size || receipt.sha256 !== digest(fs.readFileSync(archive))) {
    throw new Error('Artifact receipt, checksum or saved target does not match');
  }
  command('unzip', ['-t', archive]);
  const entries = command('unzip', ['-Z1', archive]).trim().split('\n');
  if (new Set(entries).size !== entries.length || entries.some((entry) =>
    entry.startsWith('/') || entry.split('/').includes('..') || entry.includes('\\')) ||
      !entries.includes('index.html') || !entries.includes('staticwebapp.config.json')) {
    throw new Error('Unsafe or incomplete ZIP entries');
  }
  verifyConfig(command('unzip', ['-p', archive, 'index.html']),
    command('unzip', ['-p', archive, 'staticwebapp.config.json']), values);
  return receipt;
}

function artifactUrl(text) {
  let url;
  try {
    if (typeof text !== 'string' || text.length > 8192 || /[\r\n]/.test(text)) throw new Error();
    url = new URL(text);
  } catch {
    throw new Error('Invalid artifact URL; value withheld');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
      url.port || !url.hostname.includes('.') || url.hostname === 'localhost' ||
      /^[\d.]+$/.test(url.hostname) || url.hostname.endsWith('.localhost')) {
    throw new Error('Artifact URL must use an approved HTTPS hostname without credentials or fragments');
  }
  return url.href;
}

function pollingUrl(text, values, operation) {
  let url;
  try { url = new URL(text); } catch { throw new Error('Invalid ARM polling destination'); }
  const site = operation.split('?')[0].replace(/\/zipdeploy$/, '');
  const operations = new RegExp(`^/subscriptions/${values.SUBSCRIPTION_ID}/providers/Microsoft\\.Web/locations/[a-z0-9-]+/operationResults/[a-z0-9-]+$`, 'i');
  if (url.origin !== ARM || url.username || url.password || url.hash ||
      !(url.pathname.toLowerCase() === `${site}/zipdeploy`.toLowerCase() ||
        url.pathname.toLowerCase().startsWith(`${site}/operations/`.toLowerCase()) ||
        operations.test(url.pathname)) ||
      [...url.searchParams.keys()].some((key) => key !== 'api-version') ||
      url.searchParams.getAll('api-version').length !== 1 ||
      !/^\d{4}-\d{2}-\d{2}(-preview)?$/.test(url.searchParams.get('api-version') || '')) {
    throw new Error('ARM polling destination is outside the selected subscription/site contract');
  }
  return url.href;
}

function retryDelay(response) {
  const raw = response.headers.get('retry-after');
  if (raw === null) return 5000;
  if (!/^\d+$/.test(raw) || Number(raw) > 60) throw new Error('Unsupported ARM Retry-After; retry manually');
  return Number(raw) * 1000;
}

async function readBody(response, limit, consume) {
  if (!response.body) return;
  const reader = response.body.getReader();
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error();
      }
      consume(value);
    }
  } catch {
    throw new Error('Response stream failed, timed out or exceeded its size limit; content withheld');
  } finally {
    reader.releaseLock();
  }
}

async function armBody(response) {
  const parts = [];
  await readBody(response, 1048576, (value) => parts.push(value));
  if (!parts.length) return null;
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { throw new Error('Invalid ARM response JSON; content withheld'); }
}

async function deployHostedRelease(values, receipt, text, options = {}) {
  identity(values);
  const url = artifactUrl(text);
  const request = options.request || fetch;
  const now = options.now || (() => performance.now());
  const wait = options.wait || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const getToken = options.getToken || (() => {
    let result;
    try {
      result = JSON.parse(command('az', ['account', 'get-access-token', '--subscription', values.SUBSCRIPTION_ID,
        '--resource', `${ARM}/`, '--output', 'json']));
    } catch { throw new Error('ARM token acquisition failed; Azure output withheld'); }
    if (!result || typeof result.subscription !== 'string' || typeof result.tenant !== 'string' ||
        result.subscription.toLowerCase() !== values.SUBSCRIPTION_ID.toLowerCase() ||
        result.tenant.toLowerCase() !== values.TENANT_ID.toLowerCase() ||
        typeof result.accessToken !== 'string' || !result.accessToken || /[\r\n]/.test(result.accessToken)) {
      throw new Error('ARM token context does not match saved state');
    }
    return result.accessToken;
  });
  const deadline = now() + 900000;
  async function send(destination, init, label) {
    const remaining = deadline - now();
    if (remaining <= 0) throw new Error('ARM deployment timed out; completion not verified');
    try {
      return await request(destination, { ...init, redirect: 'manual',
        signal: AbortSignal.timeout(Math.max(1, Math.min(30000, Math.floor(remaining)))) });
    } catch { throw new Error(`${label} transport/timeout failure; details withheld`); }
  }
  if (!Number.isSafeInteger(receipt.bytes) || receipt.bytes < 1 || receipt.bytes > MAX_ZIP ||
      !/^[a-f0-9]{64}$/.test(receipt.sha256 || '')) throw new Error('Invalid release checksum/size');
  const hosted = await send(url, { method: 'GET' }, 'Hosted ZIP');
  if (hosted.status !== 200) throw new Error(`Hosted ZIP HTTP ${hosted.status}; no deployment submitted`);
  const hash = createHash('sha256');
  let received = 0;
  await readBody(hosted, receipt.bytes, (chunk) => { received += chunk.byteLength; hash.update(chunk); });
  if (received !== receipt.bytes || hash.digest('hex') !== receipt.sha256) {
    throw new Error('Hosted ZIP checksum/size differs from the prepared release; no deployment submitted');
  }
  const operation = `/subscriptions/${values.SUBSCRIPTION_ID}/resourceGroups/${values.RESOURCE_GROUP}/providers/Microsoft.Web/staticSites/${values.SWA_NAME}/zipdeploy?api-version=${API}`;
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  let response = await send(`${ARM}${operation}`, { method: 'POST', headers,
    body: JSON.stringify({ properties: { appZipUrl: url, provider: 'Azure-PaaS-Workshop' } }) }, 'ARM ZIP deployment');
  if (![200, 202].includes(response.status)) {
    throw new Error(`ARM ZIP deployment HTTP ${response.status}; Azure error content withheld`);
  }
  let body = await armBody(response);
  if (response.status === 200) {
    if (body?.status && String(body.status).toLowerCase() !== 'succeeded') {
      throw new Error('ARM immediate response did not report successful completion');
    }
    return { status: 'arm_completed', polls: 0, sha256: receipt.sha256, workshopReady: false };
  }
  const asyncLocation = response.headers.get('azure-asyncoperation');
  const location = asyncLocation || response.headers.get('location');
  if (!location) throw new Error('ARM accepted upload without a polling destination; completion not verified');
  const poll = pollingUrl(location, values, operation);
  for (let attempt = 1; attempt <= 120; attempt++) {
    const delay = retryDelay(response);
    if (now() + delay >= deadline) throw new Error('ARM deployment timed out; completion not verified');
    await wait(delay);
    response = await send(poll, { method: 'GET', headers: { Authorization: headers.Authorization } }, 'ARM operation polling');
    if (![200, 202].includes(response.status)) {
      throw new Error(`ARM operation HTTP ${response.status}; completion not verified`);
    }
    body = await armBody(response);
    const status = typeof body?.status === 'string' ? body.status.toLowerCase() : '';
    if (['failed', 'canceled', 'cancelled'].includes(status)) throw new Error('ARM operation failed or was canceled; details withheld');
    if (response.status === 200 && (status === 'succeeded' || (!asyncLocation && body === null))) {
      return { status: 'arm_completed', polls: attempt, sha256: receipt.sha256, workshopReady: false };
    }
    if (!['inprogress', 'running', 'accepted', 'succeeded'].includes(status) &&
        !(response.status === 202 && body === null)) throw new Error('ARM operation returned an unknown completion state');
  }
  throw new Error('ARM polling exhausted 120 attempts; completion not verified');
}

async function deploySavedRelease(stateDirectory, archive, url, options = {}) {
  const saved = readState(stateDirectory, 'deployed');
  const receipt = verifyRelease(archive, saved);
  const targets = (options.loadTargets || loadAppTargets)(stateDirectory);
  const current = identity(targets.values);
  if (Object.keys(current).some((key) => receipt.target[key] !== current[key])) {
    throw new Error('Saved target changed during deployment validation');
  }
  const completion = await deployHostedRelease(targets.values, receipt, url, options);
  const inspect = options.inspect || inspectPublicApp;
  const now = options.now || (() => performance.now());
  const wait = options.wait || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const deadline = now() + 180000;
  const readinessSignal = AbortSignal.timeout(180000);
  const request = (destination, init) => (options.request || fetch)(destination, {
    ...init, signal: AbortSignal.any([readinessSignal, init.signal]),
  });
  let lastFailure;
  for (let attempt = 1; attempt <= 6 && now() < deadline; attempt++) {
    try {
      const report = await inspect(targets.values, targets.appHostname, request);
      const html = await readResponse(`https://${targets.values.SWA_HOSTNAME}/`,
        'frontend-release', request, false);
      const expected = command('unzip', ['-p', archive, 'index.html']);
      if (html !== expected) throw new Error('Frontend has not served the exact prepared index.html');
      return { ...completion, status: 'arm_release_public_checks_passed',
        sourceRevision: receipt.sourceRevision, sourceDirty: receipt.sourceDirty, checks: report.checks,
        notVerified: ['browser consent/MSAL', 'authenticated CRUD', 'private data path', 'telemetry', 'owned artifact cleanup'] };
    } catch (error) {
      lastFailure = error;
      if (attempt < 6 && now() + 5000 < deadline) await wait(5000);
    }
  }
  throw new Error(`ARM completed but release/public readiness is unverified: ${lastFailure?.message || 'probe deadline'}`);
}

async function main() {
  const [mode, state, first, second] = process.argv.slice(2);
  if (mode === 'prepare' && process.argv.length === 6) {
    const receipt = prepareRelease(first, second, readState(state, 'deployed'));
    console.log(JSON.stringify({ status: 'prepared_not_deployed', ...receipt }, null, 2));
  } else if (mode === 'deploy' && process.argv.length === 5) {
    const buffer = Buffer.alloc(8193);
    let length = 0, count;
    while ((count = fs.readSync(0, buffer, length, buffer.length - length, null)) > 0) {
      length += count;
      if (length === buffer.length) throw new Error('Artifact URL input exceeds its limit');
    }
    console.log(JSON.stringify(await deploySavedRelease(state, first, buffer.subarray(0, length).toString('utf8')), null, 2));
  } else throw new Error('Usage: deploy-swa-arm.cjs prepare <state> <dist> <new.zip> | deploy <state> <prepared.zip> (URL on stdin)');
}

if (require.main === module) main().catch((error) => {
  console.error(`ARM frontend deployment failed: ${error.message}`);
  process.exitCode = 1;
});

module.exports = { prepareRelease, verifyRelease, deployHostedRelease, deploySavedRelease, artifactUrl, pollingUrl };
