#!/usr/bin/env node

const { performance } = require('node:perf_hooks');
const { setTimeout } = require('node:timers/promises');
const { isAzureHostname } = require('./workshop-state.cjs');
const { loadAppTargets, readResponse } = require('./check-workshop-app.cjs');

async function observeRecovery(appHostname, swaHostname, {
  request = fetch, attempts = 30, interval = 15000, clock = () => performance.now(),
  timestamp = () => new Date().toISOString(), wait = setTimeout, emit = () => {},
} = {}) {
  if (!isAzureHostname(appHostname, 'azurewebsites.net') ||
      !isAzureHostname(swaHostname, 'azurestaticapps.net')) throw new Error('Unexpected recovery hostname');
  if (!Number.isInteger(attempts) || attempts < 2 || attempts > 60 ||
      !Number.isInteger(interval) || interval < 1000 || interval > 60000) {
    throw new Error('Invalid bounded recovery observation limits');
  }
  const started = clock();
  let failureAt = null;
  let healthySince = null;
  let consecutiveHealthy = 0;
  let rateLimitObserved = false;
  emit({ event: 'observation_started', at: timestamp(), attempts, intervalMs: interval });
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const routes = await Promise.all([
      ['direct', `https://${appHostname}/health`], ['swa', `https://${swaHostname}/api/health`],
    ].map(async ([route, url]) => {
      try {
        const body = await readResponse(url, route, request);
        return { route, result: body?.status === 'healthy' ? 'healthy' : 'unhealthy' };
      } catch (error) {
        if (/HTTP 429;/.test(error.message)) return { route, result: 'rate_limited' };
        if (/HTTP \d+;/.test(error.message)) {
          return { route, result: 'http_error', status: Number(error.message.match(/HTTP (\d+);/)[1]) };
        }
        return { route, result: 'transport_or_contract_error' };
      }
    }));
    const elapsed = Math.round(clock() - started);
    const healthy = routes.every((route) => route.result === 'healthy');
    rateLimitObserved ||= routes.some((route) => route.result === 'rate_limited');
    if (routes.some((route) => route.result !== 'healthy' && route.result !== 'rate_limited') && failureAt === null) {
      failureAt = elapsed;
    }
    if (healthy) {
      if (!consecutiveHealthy) healthySince = elapsed;
      consecutiveHealthy++;
    } else {
      consecutiveHealthy = 0;
      healthySince = null;
    }
    emit({ event: 'sample', at: timestamp(), attempt, elapsedMs: elapsed, routes });
    // Keep observing an initially healthy app; that is not recovery evidence.
    if (failureAt !== null && consecutiveHealthy >= 2) {
      return { status: 'observed_recovery', workshopReady: false, outageObserved: true,
        detectedAfterMs: failureAt, firstHealthyAfterMs: healthySince, confirmedAfterMs: elapsed,
        observedRecoveryMs: elapsed - failureAt, rateLimitObserved,
        notVerified: ['operation completion', 'new release', 'authenticated CRUD/data integrity', 'DB failover/RTO/SLA'] };
    }
    if (attempt < attempts) await wait(interval);
  }
  return { status: failureAt === null && consecutiveHealthy >= 2
    ? 'healthy_without_observed_outage' : 'observation_exhausted',
  workshopReady: false, outageObserved: failureAt !== null, observedRecoveryMs: null, rateLimitObserved,
  notVerified: ['recovery duration', 'operation completion', 'new release', 'authenticated CRUD/data integrity', 'DB failover/RTO/SLA'] };
}

if (require.main === module) {
  (async () => {
    const { values, appHostname } = loadAppTargets(process.argv[2]);
    const report = await observeRecovery(appHostname, values.SWA_HOSTNAME, {
      emit: (event) => console.log(JSON.stringify(event)),
    });
    console.log(JSON.stringify({ event: 'result', ...report }));
    if (report.status === 'observation_exhausted') process.exitCode = 1;
  })().catch((error) => {
    console.error(`Recovery observation failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { observeRecovery };
