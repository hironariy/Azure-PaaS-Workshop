#!/usr/bin/env node

const { azureJson } = require('./check-role-assignment-permission.cjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDERS = ['Microsoft.Web', 'Microsoft.DocumentDB', 'Microsoft.KeyVault',
  'Microsoft.Insights', 'Microsoft.AlertsManagement', 'Microsoft.OperationalInsights',
  'Microsoft.Network', 'Microsoft.Authorization'];
const PRIMARY_TYPES = [
  ['Microsoft.Web', 'serverfarms'], ['Microsoft.Web', 'sites'],
  ['Microsoft.DocumentDB', 'mongoClusters'], ['Microsoft.KeyVault', 'vaults'],
  ['Microsoft.Insights', 'components'], ['Microsoft.OperationalInsights', 'workspaces'],
  ['Microsoft.Network', 'virtualNetworks'], ['Microsoft.Network', 'privateEndpoints'],
];

function inspectCatalog(subscription, tenant, location, swaLocation, sku, invoke = azureJson) {
  if (!UUID.test(subscription) || !UUID.test(tenant) ||
      !/^[a-z0-9]{2,40}$/.test(location) || !/^[a-z0-9]{2,40}$/.test(swaLocation) ||
      !/^[A-Z][A-Z0-9]{1,10}$/.test(sku)) {
    throw new Error('Supply subscription/tenant UUIDs, Azure region names, and an App Service SKU');
  }
  const account = invoke(['account', 'show']);
  if (!account || typeof account.id !== 'string' || typeof account.tenantId !== 'string' ||
      account.id.toLowerCase() !== subscription.toLowerCase() ||
      account.tenantId.toLowerCase() !== tenant.toLowerCase() || account.state !== 'Enabled' ||
      account.environmentName !== 'AzureCloud') {
    throw new Error('Current subscription/tenant/public-cloud context does not match');
  }
  // account list-locations has no explicit subscription selector in the installed CLI.
  const regionResponse = invoke(['rest', '--method', 'GET', '--url',
    `https://management.azure.com/subscriptions/${subscription}/locations?api-version=2022-12-01`]);
  if (!regionResponse || regionResponse.nextLink) throw new Error('Invalid or paginated subscription region response');
  const regions = regionResponse.value;
  if (!Array.isArray(regions) || regions.some((region) =>
    !region || typeof region.name !== 'string' || !region.name.trim() ||
    typeof region.displayName !== 'string' || !region.displayName.trim())) {
    throw new Error('Invalid subscription region metadata');
  }
  const checks = [];
  const resolveRegion = (name) => {
    const region = regions.find((item) => item.name.toLowerCase() === name);
    if (!region) throw new Error(`Region is not advertised for this subscription: ${name}`);
    return region;
  };
  const primary = resolveRegion(location);
  const swa = resolveRegion(swaLocation);
  const metadata = new Map();
  for (const namespace of PROVIDERS) {
    const provider = invoke(['provider', 'show', '--subscription', subscription, '--namespace', namespace]);
    if (!provider || typeof provider.namespace !== 'string' ||
        provider.namespace.toLowerCase() !== namespace.toLowerCase() ||
        typeof provider.registrationState !== 'string' || !Array.isArray(provider.resourceTypes)) {
      throw new Error(`Invalid provider metadata: ${namespace}`);
    }
    metadata.set(namespace, provider);
    const free = provider.registrationPolicy === 'RegistrationFree';
    checks.push({ check: `${namespace}/registration`, passed: free || provider.registrationState === 'Registered',
      detail: free ? 'RegistrationFree' : provider.registrationState });
  }
  const normalize = (name) => name.toLowerCase().replace(/\s+/g, '');
  for (const [namespace, type, region] of [
    ...PRIMARY_TYPES.map(([namespace, type]) => [namespace, type, primary]),
    ['Microsoft.Web', 'staticSites', swa],
  ]) {
    const types = metadata.get(namespace).resourceTypes;
    if (types.some((item) => !item || typeof item.resourceType !== 'string')) {
      throw new Error(`Invalid resource-type metadata: ${namespace}`);
    }
    const resource = types.find((item) => item.resourceType.toLowerCase() === type.toLowerCase());
    if (!resource) {
      checks.push({ check: `${namespace}/${type}/region`, passed: false, detail: 'Resource type not advertised' });
      continue;
    }
    if (!Array.isArray(resource.locations) || resource.locations.some((value) => typeof value !== 'string')) {
      throw new Error(`Invalid location metadata: ${namespace}/${type}`);
    }
    checks.push({ check: `${namespace}/${type}/region`,
      passed: resource.locations.some((value) => normalize(value) === normalize(region.displayName) ||
        normalize(value) === normalize(region.name)), detail: region.name });
  }
  const skuRegions = invoke(['appservice', 'list-locations', '--subscription', subscription,
    '--sku', sku, '--linux-workers-enabled']);
  if (!Array.isArray(skuRegions) || skuRegions.some((item) =>
    !item || typeof item.name !== 'string' || !item.name.trim() ||
    (item.displayName !== undefined && (typeof item.displayName !== 'string' || !item.displayName.trim())))) {
    throw new Error('Invalid App Service SKU region metadata');
  }
  checks.push({ check: `AppService/Linux/${sku}/region`,
    passed: skuRegions.some((item) => [item.name, item.displayName].filter(Boolean)
      .some((name) => normalize(name) === normalize(primary.name) || normalize(name) === normalize(primary.displayName))),
    detail: primary.name });
  const catalogPassed = checks.every((check) => check.passed);
  return {
    status: catalogPassed ? 'catalog_checks_passed' : 'catalog_checks_blocked',
    deploymentReady: false, subscription, location, swaLocation, appServiceSku: sku, checks,
    notVerified: ['RBAC/deny/Policy', 'Entra registration/consent', 'subscription quota',
      'physical capacity', 'MongoDB M25 tier eligibility', 'SWA Standard/Linked Backend eligibility',
      'parameter-file consistency', 'deployment validation'],
  };
}

if (require.main === module) {
  try {
    if (process.argv.length !== 7) {
      throw new Error('Usage: node scripts/check-paas-catalog.cjs <subscription> <tenant> <location> <swa-location> <app-sku>');
    }
    const report = inspectCatalog(...process.argv.slice(2));
    console.log(JSON.stringify(report, null, 2));
    console.error('Catalog metadata is not quota, capacity or deployment readiness. No resources were created.');
    if (report.status === 'catalog_checks_blocked') process.exitCode = 3;
  } catch (error) {
    console.error(`PaaS catalog check failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { inspectCatalog };
