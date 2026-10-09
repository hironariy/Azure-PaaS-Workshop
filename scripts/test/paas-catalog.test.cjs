const assert = require('node:assert/strict');
const { test } = require('node:test');
const { inspectCatalog } = require('../check-paas-catalog.cjs');

const subscription = '00000000-0000-0000-0000-000000000001';
const tenant = '00000000-0000-0000-0000-000000000002';
const args = [subscription, tenant, 'japaneast', 'eastasia', 'B1'];
const types = ['serverfarms', 'sites', 'mongoClusters', 'vaults', 'components', 'workspaces',
  'virtualNetworks', 'privateEndpoints', 'staticSites'];
function fixture(overrides = {}) {
  const calls = [];
  const invoke = (command) => {
    calls.push(command);
    if (command[0] === 'account' && command[1] === 'show') {
      return { id: subscription, tenantId: tenant, state: 'Enabled', environmentName: 'AzureCloud', ...overrides.account };
    }
    if (command[0] === 'rest') return { value: overrides.regions || [
      { name: 'japaneast', displayName: 'Japan East' }, { name: 'eastasia', displayName: 'East Asia' }] };
    if (command[0] === 'appservice') return overrides.skuRegions || [{ name: 'Japan East' }];
    const namespace = command[command.indexOf('--namespace') + 1];
    if (overrides.failure) throw new Error('Lookup denied fixture');
    return { namespace, registrationState: 'Registered',
      resourceTypes: types.filter((type) => type !== overrides.missingType)
        .map((resourceType) => ({ resourceType, locations: overrides.locations || ['Japan East', 'East Asia'] })),
      ...overrides.provider };
  };
  return { invoke, calls };
}

test('catalog success has an explicit incomplete output shape and makes only read-only scoped calls', () => {
  const { invoke, calls } = fixture();
  const report = inspectCatalog(...args, invoke);
  assert.equal(report.status, 'catalog_checks_passed');
  assert.equal(report.deploymentReady, false);
  assert.equal(report.checks.length, 18);
  assert(report.notVerified.includes('subscription quota'));
  assert(report.notVerified.includes('physical capacity'));
  assert(calls.every((call) => ['account', 'provider', 'appservice', 'rest'].includes(call[0])));
  assert(calls.filter((call) => call[1] !== 'show' || call[0] !== 'account')
    .every((call) => call[0] === 'rest'
      ? call.includes('GET') && call[call.indexOf('--url') + 1].startsWith(`https://management.azure.com/subscriptions/${subscription}/locations?`)
      : call[call.indexOf('--subscription') + 1] === subscription));
  assert(calls.at(-1).includes('--linux-workers-enabled'));
  assert.equal(calls.at(-1)[calls.at(-1).indexOf('--sku') + 1], 'B1');
});

test('unregistered providers, unavailable regions, missing types and SKU exclusion block the catalog', () => {
  for (const overrides of [{ provider: { registrationState: 'NotRegistered' } },
    { locations: ['West US'] }, { missingType: 'mongoClusters' }, { skuRegions: [{ name: 'West US' }] }]) {
    const { invoke } = fixture(overrides);
    const report = inspectCatalog(...args, invoke);
    assert.equal(report.status, 'catalog_checks_blocked');
    assert(report.checks.some((check) => !check.passed));
    assert.equal(report.deploymentReady, false);
  }
});

test('registration-free providers are distinct from failed registration; provider state never triggers writes', () => {
  const { invoke, calls } = fixture({ provider: { registrationPolicy: 'RegistrationFree', registrationState: 'NotRegistered' } });
  const report = inspectCatalog(...args, invoke);
  assert.equal(report.status, 'catalog_checks_passed');
  assert.equal(report.checks[0].detail, 'RegistrationFree');
  assert(calls.every((call) => !call.includes('register')));
});

test('context mismatch and malformed/failed metadata stop explicitly rather than assuming availability', () => {
  for (const overrides of [{ account: { tenantId: subscription } }, { account: { environmentName: 'AzureChinaCloud' } },
    { regions: {} }, { failure: true }, { provider: { resourceTypes: {} } },
    { provider: { resourceTypes: [{ resourceType: 'sites', locations: null }] } }, { skuRegions: {} }]) {
    const { invoke } = fixture(overrides);
    assert.throws(() => inspectCatalog(...args, invoke));
  }
  const { invoke, calls } = fixture({ account: { state: 'Disabled' } });
  assert.throws(() => inspectCatalog(...args, invoke), /context/);
  assert.equal(calls.length, 1);
  assert.throws(() => inspectCatalog(subscription, tenant, 'not-a-region', 'eastasia', 'B1', invoke));
  assert.throws(() => inspectCatalog(subscription, tenant, 'japaneast', 'eastasia', '--help', invoke));
});
