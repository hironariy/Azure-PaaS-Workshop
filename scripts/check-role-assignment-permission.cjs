#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const ACTION = 'Microsoft.Authorization/roleAssignments/write';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function matchesAction(pattern) {
  const escaped = pattern.split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`, 'i').test(ACTION);
}

function allowsRoleAssignment(permissions) {
  if (!Array.isArray(permissions)) throw new Error('ARM permissions must be an array');
  for (const permission of permissions) {
    if (!permission || typeof permission !== 'object' ||
        !Array.isArray(permission.actions) || !Array.isArray(permission.notActions) ||
        [...permission.actions, ...permission.notActions].some((item) => typeof item !== 'string')) {
      throw new Error('ARM permission entry has invalid actions/notActions');
    }
  }
  // NotActions subtracts from a role; it is not a deny against other roles.
  return permissions.some((permission) =>
    permission.actions.some(matchesAction) && !permission.notActions.some(matchesAction));
}

function azureJson(args) {
  const result = spawnSync('az', [...args, '--output', 'json'], { encoding: 'utf8', timeout: 90000 });
  if (result.error) throw result.error;
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`Azure CLI failed: az ${args.slice(0, 2).join(' ')}`);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error('Azure CLI returned invalid JSON', { cause: error });
  }
}

function inspectPermission(subscription, tenant, resourceGroup, invoke = azureJson) {
  if (!UUID.test(subscription) || !UUID.test(tenant) ||
      typeof resourceGroup !== 'string' || !/^[a-z0-9_().-]{1,90}$/i.test(resourceGroup) ||
      resourceGroup.endsWith('.')) {
    throw new Error('Supply subscription UUID, tenant UUID, and a valid resource group name');
  }
  const account = invoke(['account', 'show', '--subscription', subscription]);
  if (!account || typeof account.id !== 'string' || typeof account.tenantId !== 'string' ||
      account.id.toLowerCase() !== subscription.toLowerCase() ||
      account.tenantId.toLowerCase() !== tenant.toLowerCase() || account.state !== 'Enabled') {
    throw new Error('Subscription/tenant mismatch or subscription not enabled');
  }
  if (account.environmentName !== 'AzureCloud') {
    throw new Error('This workshop preflight supports the Azure public cloud only');
  }
  const exists = invoke(['group', 'exists', '--subscription', subscription, '--name', resourceGroup]);
  if (typeof exists !== 'boolean') throw new Error('Resource group existence response must be boolean');
  const scope = `/subscriptions/${subscription}${exists ? `/resourceGroups/${resourceGroup}` : ''}`;
  const url = `https://management.azure.com${scope}/providers/Microsoft.Authorization/permissions?api-version=2022-04-01`;
  const permissions = [];
  let next = url;
  const visited = new Set();
  while (next) {
    if (visited.has(next) || visited.size >= 20) throw new Error('Unexpected ARM permissions pagination');
    const parsed = new URL(next);
    if (parsed.origin !== 'https://management.azure.com' || parsed.username || parsed.password ||
        parsed.pathname.toLowerCase() !== new URL(url).pathname.toLowerCase()) {
      throw new Error('Unexpected ARM permissions nextLink');
    }
    visited.add(next);
    const page = invoke(['rest', '--method', 'get', '--url', next, '--subscription', subscription]);
    if (!page || !Array.isArray(page.value)) throw new Error('ARM permissions response must contain value[]');
    permissions.push(...page.value);
    if (page.nextLink !== undefined && page.nextLink !== null && typeof page.nextLink !== 'string') {
      throw new Error('Invalid ARM permissions nextLink');
    }
    next = page.nextLink || '';
  }
  return { scope, resourceGroupExists: exists, allowed: allowsRoleAssignment(permissions) };
}

if (require.main === module) {
  try {
    if (process.argv.length !== 5) {
      throw new Error('Usage: node scripts/check-role-assignment-permission.cjs <subscription-id> <tenant-id> <resource-group>');
    }
    const result = inspectPermission(...process.argv.slice(2));
    console.log(`Read-only permission scope: ${result.scope}`);
    if (!result.resourceGroupExists) console.log('Resource group is absent; checking parent subscription permissions.');
    if (!result.allowed) {
      console.error(`BLOCKED: ${ACTION} is not reported as allowed.`);
      console.error('Contributor alone cannot create the required Key Vault role assignment. No resources were created.');
      process.exitCode = 3;
    } else {
      console.log(`${ACTION} is reported as allowed.`);
      console.log('This is not deployment readiness: deny/role conditions, Azure Policy, Entra consent, data access, regions and quotas still require verification.');
    }
  } catch (error) {
    console.error(`Permission preflight failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { allowsRoleAssignment, inspectPermission, azureJson };
