const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const directory = path.resolve(__dirname, '../../materials/bicep');
const template = JSON.parse(fs.readFileSync(path.join(directory, 'main.json'), 'utf8'));
const modules = Object.fromEntries(template.resources.map((resource) => [resource.name, resource]));

test('the orchestrator requires SWA Standard and keeps the no-HA M25/B1 baseline', () => {
  assert.equal(template.parameters.staticWebAppSku.defaultValue, 'Standard');
  assert.deepEqual(template.parameters.staticWebAppSku.allowedValues, ['Standard']);
  assert.equal(template.parameters.cosmosDbTier.defaultValue, 'M25');
  assert.equal(template.parameters.cosmosDbEnableHa.defaultValue, false);
  assert.equal(template.parameters.appServiceSku.defaultValue, 'B1');
  for (const name of ['main', 'dev', 'main.fastpath', 'dev.fastpath']) {
    assert.match(fs.readFileSync(path.join(directory, `${name}.bicepparam`), 'utf8'),
      /^param staticWebAppSku = 'Standard'/m);
  }
  const swa = modules['staticwebapp-deployment'].properties.template.resources;
  const link = swa.find((resource) => resource.type === 'Microsoft.Web/staticSites/linkedBackends');
  assert(link);
  assert.match(link.condition, /Standard/);
});

test('one module writes vault/endpoint/DNS; the role-only module preserves vault-scoped assignment identity', () => {
  const resources = template.resources.flatMap((module) => module.properties.template.resources);
  assert.equal(resources.filter((resource) => resource.type === 'Microsoft.KeyVault/vaults').length, 1);
  const vault = modules['keyvault-deployment'].properties.template.resources;
  assert.equal(vault.length, 3);
  assert.equal(vault.find((resource) => resource.type === 'Microsoft.KeyVault/vaults')
    .properties.enableRbacAuthorization, true);
  assert.equal(vault.find((resource) => resource.type === 'Microsoft.KeyVault/vaults')
    .properties.publicNetworkAccess, 'Disabled');
  const rbac = modules['keyvault-rbac-deployment'];
  const inner = rbac.properties.template;
  assert.equal(inner.resources.length, 1);
  assert.equal(inner.variables.keyVaultSecretsUserRoleId, '4633458b-17de-408a-b874-0445c86b69e6');
  const role = inner.resources[0];
  assert.equal(role.type, 'Microsoft.Authorization/roleAssignments');
  assert.equal(role.scope, "[resourceId('Microsoft.KeyVault/vaults', parameters('keyVaultName'))]");
  assert.equal(role.name, "[guid(resourceId('Microsoft.KeyVault/vaults', parameters('keyVaultName')), parameters('appServicePrincipalId'), variables('keyVaultSecretsUserRoleId'))]");
  assert.equal(role.properties.principalType, 'ServicePrincipal');
  assert.equal(role.properties.principalId, "[parameters('appServicePrincipalId')]");
  assert(!Object.hasOwn(role, 'condition'));
  assert(rbac.dependsOn.some((value) => value.includes('keyvault-deployment')));
  assert(rbac.dependsOn.some((value) => value.includes('appservice-deployment')));
});
