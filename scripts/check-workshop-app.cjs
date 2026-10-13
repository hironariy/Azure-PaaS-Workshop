#!/usr/bin/env node

const path = require('node:path');
const { readState, isAzureHostname } = require('./workshop-state.cjs');
const { azureJson } = require('./check-role-assignment-permission.cjs');

async function readResponse(url, label, request, json = true) {
  let response;
  try {
    response = await request(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000),
      headers: { Accept: json ? 'application/json' : 'text/html' } });
  } catch {
    throw new Error(`${label}: transport/timeout failure`);
  }
  if (response.status !== 200) throw new Error(`${label}: HTTP ${response.status}; inspect routing/auth/startup`);
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes(json ? 'application/json' : 'text/html')) {
    throw new Error(`${label}: unexpected content type`);
  }
  if (!response.body) throw new Error(`${label}: missing response body`);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1048576) {
        await reader.cancel();
        throw new Error(`${label}: response exceeds the 1 MiB probe limit`);
      }
      chunks.push(value);
    }
  } catch {
    if (size > 1048576) throw new Error(`${label}: response exceeds the 1 MiB probe limit`);
    throw new Error(`${label}: response stream failed or timed out`);
  }
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    throw new Error(`${label}: invalid UTF-8 response`);
  }
  if (!json) return text;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}: invalid JSON`);
  }
}

async function inspectPublicApp(values, appHostname, request = fetch) {
  if (!isAzureHostname(appHostname, 'azurewebsites.net') ||
      !isAzureHostname(values.SWA_HOSTNAME, 'azurestaticapps.net')) {
    throw new Error('Unexpected App Service/SWA hostname');
  }
  const direct = `https://${appHostname}`;
  const proxy = `https://${values.SWA_HOSTNAME}`;
  const checks = [];
  for (const [label, url] of [['direct-health', `${direct}/health`], ['swa-health', `${proxy}/api/health`]]) {
    const body = await readResponse(url, label, request);
    if (!body || body.status !== 'healthy') throw new Error(`${label}: expected status=healthy`);
    checks.push({ check: label, passed: true });
  }
  for (const [label, origin] of [['direct-published-list', direct], ['swa-published-list', proxy]]) {
    const body = await readResponse(`${origin}/api/posts?page=1&limit=1`, label, request);
    if (!body || !Array.isArray(body.posts) || body.posts.length !== Math.min(body.total, 1) ||
        !Number.isSafeInteger(body.total) || body.total < body.posts.length ||
        body.page !== 1 || body.limit !== 1 || body.totalPages !== body.total ||
        body.posts.some((post) => !post || post.status !== 'published' || typeof post.slug !== 'string' || !post.slug)) {
      throw new Error(`${label}: published pagination contract mismatch`);
    }
    checks.push({ check: label, passed: true, publishedCount: body.total });
  }
  const html = await readResponse(`${proxy}/`, 'frontend-config', request, false);
  const assignment = html.match(/window\.__APP_CONFIG__\s*=\s*(\{[^<]*?\})\s*;/);
  if (!assignment) throw new Error('frontend-config: missing runtime configuration');
  let config;
  try {
    config = JSON.parse(assignment[1]);
  } catch {
    throw new Error('frontend-config: invalid runtime JSON');
  }
  if (!config || config.ENTRA_TENANT_ID !== values.TENANT_ID ||
      config.ENTRA_FRONTEND_CLIENT_ID !== values.FRONTEND_CLIENT_ID ||
      config.ENTRA_BACKEND_CLIENT_ID !== values.BACKEND_CLIENT_ID || config.API_BASE_URL !== '/api') {
    throw new Error('frontend-config: saved public identities/API route do not match');
  }
  checks.push({ check: 'frontend-config', passed: true });
  return { status: 'public_checks_passed', workshopReady: false, checks,
    notVerified: ['new release completion', 'browser MSAL/self-consent', 'authenticated CRUD',
      'draft authorization', 'telemetry ingestion', 'recovery/data integrity'] };
}

function loadAppTargets(directory, invoke = azureJson) {
  if (!directory || !path.isAbsolute(directory)) throw new Error('Supply the absolute saved state directory');
  const values = readState(directory, 'deployed');
  const account = invoke(['account', 'show']);
  if (!account || typeof account.id !== 'string' || typeof account.tenantId !== 'string' ||
      account.id.toLowerCase() !== values.SUBSCRIPTION_ID.toLowerCase() ||
      account.tenantId.toLowerCase() !== values.TENANT_ID.toLowerCase() ||
      account.state !== 'Enabled' || account.environmentName !== 'AzureCloud') {
    throw new Error('Current subscription/tenant/public-cloud context does not match saved state');
  }
  const hostname = invoke(['webapp', 'show', '--subscription', values.SUBSCRIPTION_ID,
    '--resource-group', values.RESOURCE_GROUP, '--name', values.APP_SERVICE_NAME, '--query', 'defaultHostName']);
  const actualSwa = invoke(['staticwebapp', 'show', '--subscription', values.SUBSCRIPTION_ID,
    '--resource-group', values.RESOURCE_GROUP, '--name', values.SWA_NAME, '--query', 'defaultHostname']);
  if (actualSwa !== values.SWA_HOSTNAME) throw new Error('SWA target differs from saved state');
  if (!isAzureHostname(hostname, 'azurewebsites.net')) throw new Error('Unexpected App Service hostname');
  return { values, appHostname: hostname };
}

async function inspectSavedApp(directory, invoke = azureJson, request = fetch) {
  const { values, appHostname } = loadAppTargets(directory, invoke);
  return inspectPublicApp(values, appHostname, request);
}

if (require.main === module) {
  inspectSavedApp(process.argv[2]).then((report) => console.log(JSON.stringify(report, null, 2))).catch((error) => {
    console.error(`Workshop public check failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { inspectPublicApp, inspectSavedApp, loadAppTargets, readResponse };
