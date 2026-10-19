const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const repository = path.resolve(__dirname, '../..');
const secret = 'PRIVATE_BLOB_SAS_FIXTURE';

function procedures() {
  const page = fs.readFileSync(path.join(repository, 'materials/docs/learner/day-1-deploy-frontend.ja.md'), 'utf8');
  const section = page.split('## 補足: ARM ZIP API を使ったデプロイ手順（代替方式）')[1].split('## 次に進む')[0];
  const blocks = [...section.matchAll(/```bash\n([\s\S]*?)```/g)].map(match => match[1]);
  assert.equal(blocks.length, 5);
  return { create: blocks[1], upload: blocks[2], deploy: blocks[3], cleanup: blocks[4] };
}

function fixture(t, scenario = '') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paas-blob-procedure-'));
  t.after(() => fs.rmSync(root, { recursive: true }));
  const checkout = path.join(root, 'checkout with spaces');
  const bin = path.join(root, 'bin');
  fs.mkdirSync(path.join(checkout, 'scripts'), { recursive: true });
  fs.mkdirSync(bin);
  const archive = path.join(root, 'prepared frontend.zip');
  fs.writeFileSync(archive, 'prepared ZIP fixture');
  fs.writeFileSync(`${archive}.json`, '{}');
  const log = path.join(root, 'calls.jsonl');
  const state = path.join(root, 'mock-state.json');
  fs.writeFileSync(state, '{}');
  const program = `#!${process.execPath}
const fs = require('node:fs'), path = require('node:path');
const args = process.argv.slice(2), scenario = process.env.SCENARIO;
const state = JSON.parse(fs.readFileSync(process.env.MOCK_STATE, 'utf8'));
const record = entry => fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify(entry) + '\\n');
const fail = message => { console.error(message); process.exit(23); };
const save = () => fs.writeFileSync(process.env.MOCK_STATE, JSON.stringify(state));
const flag = name => args[args.indexOf(name) + 1];
if (path.basename(process.argv[1]) === 'arm-mock.cjs') {
  const url = fs.readFileSync(0, 'utf8');
  const expected = 'https://' + state.account + '.blob.core.windows.net/frontend-artifacts/' +
    encodeURIComponent(path.basename(process.env.FRONTEND_ZIP)) + '?sp=r&sig=${secret}';
  if (url !== expected) fail('Artifact URL did not arrive on stdin');
  record({ tool: 'arm', args, urlOnStdin: true });
  if (scenario === 'arm') fail('ARM deployment failed fixture');
  console.log(JSON.stringify({ status: 'arm_release_public_checks_passed' }));
  process.exit(0);
}
record({ tool: 'az', args });
const command = args.slice(0, 3).join(' ');
if (args[0] === 'provider' && args[1] === 'register') process.exit(0);
if (command === 'storage account create') {
  if (scenario === 'create') fail('Storage creation failed fixture');
  state.account = flag('--name'); save();
} else if (command === 'storage account show') {
  if (flag('--query') === 'id') {
    console.log(scenario === 'empty-scope' ? '' : '/subscriptions/' + process.env.SUBSCRIPTION_ID +
      '/resourceGroups/' + process.env.RESOURCE_GROUP + '/providers/Microsoft.Storage/storageAccounts/' + state.account);
  } else console.log(JSON.stringify({ name: state.account, sku: 'Standard_LRS',
    anonymousAccess: false, sharedKeyAccess: false, httpsOnly: true }));
} else if (command === 'ad signed-in-user show') {
  console.log(scenario === 'empty-user' ? '' : '00000000-0000-0000-0000-000000000002');
} else if (command === 'role assignment create') {
  if (scenario === 'role') fail('Role assignment failed fixture');
} else if (command === 'storage container create') {
  if (scenario === 'container') fail('Container creation failed fixture');
} else if (command === 'storage blob upload') {
  if (scenario === 'upload') fail('Blob upload failed fixture');
  state.bytes = fs.readFileSync(flag('--file')).length; save();
} else if (command === 'storage blob show') {
  console.log(JSON.stringify({ name: flag('--name'), bytes: state.bytes }));
} else if (command === 'storage blob generate-sas') {
  if (scenario === 'sas') fail('SAS generation failed fixture');
  console.log(scenario === 'empty-sas' ? '' : 'https://' + state.account +
    '.blob.core.windows.net/' + flag('--container-name') + '/' + encodeURIComponent(flag('--name')) +
    '?sp=r&sig=${secret}');
} else if (command === 'storage account revoke-delegation-keys') {
  if (scenario === 'revoke') fail('SAS revocation failed fixture');
  state.revoked = true; save();
} else if (command === 'storage account delete') {
  if (scenario === 'delete') fail('Storage deletion failed fixture');
  state.deleted = true; save();
} else if (command === 'storage account list') {
  console.log(state.deleted && scenario !== 'leftover' ? '' : state.account);
} else fail('Unexpected Azure CLI fixture command');
`;
  fs.writeFileSync(path.join(bin, 'az'), program, { mode: 0o755 });
  const armMock = path.join(root, 'arm-mock.cjs');
  fs.writeFileSync(armMock, program);
  fs.writeFileSync(path.join(checkout, 'scripts/deploy-frontend-arm.sh'), `#!/bin/bash
set +x
set -euo pipefail
IFS= read -r -s ARTIFACT_URL
printf '%s' "$ARTIFACT_URL" | "$MOCK_NODE" "$ARM_MOCK" "$@"
`);
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    SUBSCRIPTION_ID: '00000000-0000-0000-0000-000000000001',
    RESOURCE_GROUP: 'rg-blogapp-A-paas-workshop', LOCATION: 'japaneast',
    WORKSHOP_REPO_DIR: checkout, FRONTEND_ZIP: archive,
    MOCK_NODE: process.execPath, ARM_MOCK: armMock, MOCK_LOG: log, MOCK_STATE: state, SCENARIO: scenario };
  const run = script => spawnSync('bash', ['-c', script], { env, encoding: 'utf8', timeout: 15000 });
  const calls = () => fs.existsSync(log)
    ? fs.readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line)) : [];
  return { env, run, calls, archive, state: () => JSON.parse(fs.readFileSync(state, 'utf8')) };
}

function command(calls, name) {
  return calls.find(call => call.tool === 'az' && call.args.slice(0, 3).join(' ') === name);
}

function option(call, name) {
  assert(call.args.includes(name), `Missing ${name}`);
  return call.args[call.args.indexOf(name) + 1];
}

test('exact learner Blob workflow creates private keyless storage, uploads the prepared ZIP and cleans up', t => {
  const f = fixture(t);
  const steps = procedures();
  const before = Date.now();
  const run = f.run([steps.create, steps.upload, steps.deploy, steps.cleanup].join('\n'));
  assert.equal(run.status, 0, run.stderr);
  const after = Date.now();
  const calls = f.calls();
  const create = command(calls, 'storage account create');
  const account = option(create, '--name');
  assert.match(account, /^stpaaszip[0-9a-f]{12}$/);
  assert.equal(option(create, '--resource-group'), f.env.RESOURCE_GROUP);
  assert.equal(option(create, '--location'), f.env.LOCATION);
  for (const [name, value] of Object.entries({
    '--sku': 'Standard_LRS', '--kind': 'StorageV2', '--https-only': 'true',
    '--min-tls-version': 'TLS1_2', '--allow-blob-public-access': 'false',
    '--allow-shared-key-access': 'false', '--public-network-access': 'Enabled', '--default-action': 'Allow',
  })) assert.equal(option(create, name), value);
  const role = command(calls, 'role assignment create');
  assert.equal(option(role, '--role'), 'Storage Blob Data Contributor');
  assert.equal(option(role, '--assignee-principal-type'), 'User');
  assert.equal(option(role, '--scope'), `/subscriptions/${f.env.SUBSCRIPTION_ID}/resourceGroups/${f.env.RESOURCE_GROUP}/providers/Microsoft.Storage/storageAccounts/${account}`);
  const upload = command(calls, 'storage blob upload');
  assert.equal(option(upload, '--file'), f.archive);
  assert.equal(option(upload, '--name'), path.basename(f.archive));
  assert.equal(option(command(calls, 'storage container create'), '--public-access'), 'off');
  const sas = command(calls, 'storage blob generate-sas');
  assert.equal(option(sas, '--permissions'), 'r');
  assert(sas.args.includes('--as-user') && sas.args.includes('--https-only') && sas.args.includes('--full-uri'));
  const expiry = Date.parse(option(sas, '--expiry'));
  assert(expiry >= before + 3600000 - 1000 && expiry <= after + 3600000);
  for (const call of calls.filter(call => call.tool === 'az')) {
    if (call.args[0] === 'storage' && ['container', 'blob'].includes(call.args[1])) {
      assert.equal(option(call, '--auth-mode'), 'login');
    }
    if (call.args[0] !== 'ad') assert.equal(option(call, '--subscription'), f.env.SUBSCRIPTION_ID);
  }
  const deploy = calls.find(call => call.tool === 'arm');
  assert.deepEqual(deploy.args, [f.env.RESOURCE_GROUP, 'deploy', f.archive]);
  assert(deploy.urlOnStdin);
  assert(f.state().revoked && f.state().deleted);
  assert(calls.indexOf(deploy) < calls.indexOf(command(calls, 'storage account revoke-delegation-keys')));
  assert.equal(option(command(calls, 'storage account delete'), '--name'), account);
  assert.match(run.stdout, /一時 Storage Account を削除しました/);
  assert.doesNotMatch(run.stdout + run.stderr + JSON.stringify(calls), new RegExp(secret));
  assert(calls.every(call => !call.args.includes('--account-key') && !call.args.includes('--connection-string')));
});

test('exact learner Blob creation stops before unsafe role grants on creation failure or missing IDs', t => {
  for (const scenario of ['create', 'empty-scope', 'empty-user', 'role']) {
    const f = fixture(t, scenario);
    const run = f.run(procedures().create);
    assert.notEqual(run.status, 0, scenario);
    assert(!command(f.calls(), 'storage blob upload'));
    if (scenario !== 'role') assert(!command(f.calls(), 'role assignment create'));
  }
});

test('exact learner Blob upload stops on RBAC or upload failure without reporting a stored ZIP', t => {
  for (const scenario of ['container', 'upload']) {
    const f = fixture(t, scenario);
    const steps = procedures();
    const run = f.run(`${steps.create}\n${steps.upload}`);
    assert.notEqual(run.status, 0, scenario);
    assert(!command(f.calls(), 'storage blob show'));
    assert(!command(f.calls(), 'storage blob generate-sas'));
  }
});

test('exact learner Blob SAS and deploy failures cannot report completion or prematurely remove staging', t => {
  for (const scenario of ['sas', 'empty-sas', 'arm']) {
    const f = fixture(t, scenario);
    const steps = procedures();
    const run = f.run([steps.create, steps.upload, steps.deploy].join('\n'));
    assert.notEqual(run.status, 0, scenario);
    assert.doesNotMatch(run.stdout + run.stderr, /arm_release_public_checks_passed|PRIVATE_BLOB_SAS_FIXTURE/);
    assert(!f.state().deleted);
    if (scenario !== 'arm') assert(!f.calls().some(call => call.tool === 'arm'));
  }
});

test('exact learner Blob cleanup reports revocation, deletion and leftover-account failures', t => {
  for (const scenario of ['revoke', 'delete', 'leftover']) {
    const f = fixture(t, scenario);
    const steps = procedures();
    const run = f.run([steps.create, steps.upload, steps.deploy, steps.cleanup].join('\n'));
    assert.notEqual(run.status, 0, scenario);
    assert.doesNotMatch(run.stdout, /一時 Storage Account を削除しました/);
  }
});

test('exact learner Blob SAS stays off shell traces, arguments and the parent shell', t => {
  const f = fixture(t);
  const steps = procedures();
  const run = f.run('set -x\n' + [steps.create, steps.upload, steps.deploy].join('\n') +
    '\nset +x\nif [ -n "${ARTIFACT_URL:-}" ]; then echo "SAS escaped its subshell" >&2; exit 1; fi');
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout + run.stderr + JSON.stringify(f.calls()), new RegExp(secret));
  assert(f.calls().some(call => call.tool === 'arm' && call.urlOnStdin));
});
