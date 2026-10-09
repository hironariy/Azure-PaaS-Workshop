const assert = require('node:assert/strict');
const { test } = require('node:test');
const { allowsRoleAssignment, inspectPermission } = require('../check-role-assignment-permission.cjs');

const subscription = '00000000-0000-0000-0000-000000000001';
const tenant = '00000000-0000-0000-0000-000000000002';
const contributor = { actions: ['*'], notActions: ['Microsoft.Authorization/*/Write'] };
const owner = { actions: ['*'], notActions: [] };
const account = { id: subscription, tenantId: tenant, state: 'Enabled', environmentName: 'AzureCloud' };

test('Contributor cannot assign roles, but NotActions does not deny an independent grant', () => {
  assert.equal(allowsRoleAssignment([contributor]), false);
  assert.equal(allowsRoleAssignment([contributor, owner]), true);
  assert.equal(allowsRoleAssignment([{ actions: ['microsoft.authorization/roleassignments/WRITE'], notActions: [] }]), true);
  assert.equal(allowsRoleAssignment([{ actions: ['MicrosoftXAuthorization/*'], notActions: [] }]), false);
  assert.equal(allowsRoleAssignment([]), false);
});

test('malformed ARM responses fail explicitly', () => {
  for (const value of [null, {}, [{ actions: '*', notActions: [] }], [{ actions: ['*'] }], [{ actions: [42], notActions: [] }]]) {
    assert.throws(() => allowsRoleAssignment(value));
  }
});

test('explicit tenant/context validation fails before resource queries', () => {
  const calls = [];
  assert.throws(() => inspectPermission(subscription, tenant, 'rg-fixture', (args) => {
    calls.push(args);
    return { ...account, tenantId: subscription };
  }), /mismatch/);
  assert.equal(calls.length, 1);
  assert.throws(() => inspectPermission('', tenant, 'rg-fixture'), /Supply/);
  assert.throws(() => inspectPermission(subscription, tenant, 'rg-fixture', () => ({
    ...account, state: 'Disabled',
  })), /not enabled/);
});

test('absent resource groups check the subscription without creating anything', () => {
  const calls = [];
  const result = inspectPermission(subscription, tenant, 'rg-fixture', (args) => {
    calls.push(args);
    if (args[0] === 'account') return account;
    if (args[0] === 'group') return false;
    return { value: [contributor] };
  });
  assert.equal(result.allowed, false);
  assert.equal(result.scope, `/subscriptions/${subscription}`);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((args) => args.includes(subscription)));
  assert.ok(calls.every((args) => !args.includes('create') && !args.includes('set')));
});

test('resource-group scope and paginated grants are evaluated together', () => {
  let pages = 0;
  const result = inspectPermission(subscription, tenant, 'rg-fixture', (args) => {
    if (args[0] === 'account') return account;
    if (args[0] === 'group') return true;
    pages++;
    return pages === 1 ? {
      value: [contributor], nextLink: `${args[args.indexOf('--url') + 1]}&page=2`,
    } : { value: [owner] };
  });
  assert.equal(result.scope, `/subscriptions/${subscription}/resourceGroups/rg-fixture`);
  assert.equal(result.allowed, true);
  assert.equal(pages, 2);
});

test('lookup errors, invalid values, and foreign or cyclic pagination never become success', () => {
  for (const page of [{}, { value: [], nextLink: 42 }, { value: [], nextLink: 'https://example.invalid/permissions' }]) {
    assert.throws(() => inspectPermission(subscription, tenant, 'rg-fixture', (args) => {
      if (args[0] === 'account') return account;
      if (args[0] === 'group') return true;
      return page;
    }));
  }
  assert.throws(() => inspectPermission(subscription, tenant, 'rg-fixture', () => {
    throw new Error('AuthorizationFailed fixture');
  }), /AuthorizationFailed/);
  assert.throws(() => inspectPermission(subscription, tenant, 'rg-fixture', (args) => {
    if (args[0] === 'account') return account;
    if (args[0] === 'group') return 'false';
  }), /must be boolean/);
  assert.throws(() => inspectPermission(subscription, tenant, 'rg-fixture', (args) => {
    if (args[0] === 'account') return account;
    if (args[0] === 'group') return true;
    return { value: [], nextLink: args[args.indexOf('--url') + 1] };
  }), /pagination/);
});
