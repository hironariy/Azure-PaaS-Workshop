const assert = require('node:assert/strict');
const { test } = require('node:test');
const { observeRecovery } = require('../observe-workshop-recovery.cjs');

function fixture(results) {
  let calls = 0;
  let elapsed = 0;
  const events = [];
  const waits = [];
  return { events, waits, options: {
    attempts: results.length, interval: 15000, clock: () => elapsed,
    timestamp: () => '2026-01-01T00:00:00.000Z', emit: (event) => events.push(event),
    wait: async (duration) => { waits.push(duration); elapsed += duration; },
    request: async (url, options) => {
      assert(url.endsWith('/health') && !url.includes('/posts'));
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'manual');
      const value = results[Math.floor(calls++ / 2)];
      if (value === 'transport') throw new Error('PRIVATE_RECOVERY_FIXTURE');
      return new Response(value === 'html' ? 'PRIVATE_RECOVERY_FIXTURE' : JSON.stringify({ status: 'healthy' }),
        { status: typeof value === 'number' ? value : 200,
          headers: { 'content-type': value === 'html' ? 'text/html' : 'application/json' } });
    },
  } };
}

test('a detected outage requires two healthy pairs; initial health is never recovery', async () => {
  const { options, events, waits } = fixture([200, 503, 200, 200]);
  const report = await observeRecovery('fixture.azurewebsites.net', 'fixture.2.azurestaticapps.net', options);
  assert.equal(report.status, 'observed_recovery');
  assert.equal(report.detectedAfterMs, 15000);
  assert.equal(report.firstHealthyAfterMs, 30000);
  assert.equal(report.confirmedAfterMs, 45000);
  assert.equal(report.observedRecoveryMs, 30000);
  assert.equal(report.workshopReady, false);
  assert.equal(events.filter((event) => event.event === 'sample').length, 4);
  assert.equal(waits.length, 3);
});

test('no observed outage does not fabricate a zero recovery duration or stop before injection', async () => {
  const { options, events, waits } = fixture([200, 200, 200]);
  const report = await observeRecovery('fixture.azurewebsites.net', 'fixture.azurestaticapps.net', options);
  assert.equal(report.status, 'healthy_without_observed_outage');
  assert.equal(report.outageObserved, false);
  assert.equal(report.observedRecoveryMs, null);
  assert.equal(events.filter((event) => event.event === 'sample').length, 3);
  assert.equal(waits.length, 2);
});

test('429 is throttling, not an outage timestamp; transient health must be stable', async () => {
  const { options } = fixture([429, 503, 200, 503, 200, 200]);
  const report = await observeRecovery('fixture.azurewebsites.net', 'fixture.azurestaticapps.net', options);
  assert.equal(report.rateLimitObserved, true);
  assert.equal(report.detectedAfterMs, 15000);
  assert.equal(report.confirmedAfterMs, 75000);
});

test('contract/transport failures exhaust bounded attempts, never log bodies, and skip final sleep', async () => {
  const { options, events, waits } = fixture(['transport', 'html', 503]);
  const report = await observeRecovery('fixture.azurewebsites.net', 'fixture.azurestaticapps.net', options);
  assert.equal(report.status, 'observation_exhausted');
  assert.equal(report.observedRecoveryMs, null);
  assert.equal(waits.length, 2);
  assert(!JSON.stringify(events).includes('PRIVATE_RECOVERY_FIXTURE'));
  await assert.rejects(() => observeRecovery('foreign.example', 'fixture.azurestaticapps.net', options), /hostname/);
  await assert.rejects(() => observeRecovery('fixture.azurewebsites.net', 'fixture.azurestaticapps.net',
    { ...options, attempts: 0 }), /limits/);
});

test('one unhealthy route and intervening throttling prevent premature recovery', async () => {
  let calls = 0;
  const { options } = fixture([503, 200, 429, 200, 200]);
  const pairs = [[200, 503], [200, 200], [429, 200], [200, 200], [200, 200]];
  options.request = async () => {
    const status = pairs[Math.floor(calls / 2)][calls++ % 2];
    return new Response('{"status":"healthy"}', { status, headers: { 'content-type': 'application/json' } });
  };
  const report = await observeRecovery('fixture.azurewebsites.net', 'fixture.azurestaticapps.net', options);
  assert.equal(report.status, 'observed_recovery');
  assert.equal(report.detectedAfterMs, 0);
  assert.equal(report.confirmedAfterMs, 60000);
  assert.equal(report.rateLimitObserved, true);
});
