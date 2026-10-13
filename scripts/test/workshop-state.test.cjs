const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { validate, readState, writeState } = require('../workshop-state.cjs');

const repository = path.resolve(__dirname, '../..');
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'paas-state-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  const values = {
    WORKSHOP_REPO_DIR: repository, WORKSHOP_STATE_DIR: directory,
    LOCATION: 'japaneast', SWA_LOCATION: 'eastasia', BASE_NAME: 'blogapp',
    GROUP_ID: 'B', RESOURCE_GROUP: 'rg-blogapp-B-paas-workshop',
    PARAM_FILE: path.join(directory, 'dev.local.bicepparam'),
    SUBSCRIPTION_ID: '00000000-0000-0000-0000-000000000001',
    TENANT_ID: '00000000-0000-0000-0000-000000000002',
  };
  return { directory, values };
}

test('fresh state is private, repeat initialization cannot overwrite, save is atomic without duplicate keys', (t) => {
  const { directory, values } = fixture(t);
  writeState(directory, values, true);
  assert.equal(fs.statSync(path.join(directory, 'paas-workshop.json')).mode & 0o777, 0o600);
  assert.deepEqual(readState(directory), values);
  assert.throws(() => writeState(directory, values, true), /already initialized/);
  const updated = { ...values, BACKEND_CLIENT_ID: '00000000-0000-0000-0000-000000000003' };
  writeState(directory, updated);
  writeState(directory, updated);
  assert.deepEqual(readState(directory), updated);
  assert.deepEqual(fs.readdirSync(directory), ['paas-workshop.json']);
  assert.throws(() => writeState(directory, { ...values, RESOURCE_GROUP: 'rg-other' }), /Target changed/);
  assert.deepEqual(readState(directory), updated);
});

test('missing, corrupt, unsupported, executable, and stale-path state fail explicitly', (t) => {
  const { directory, values } = fixture(t);
  assert.throws(() => readState(directory), /ENOENT/);
  const file = path.join(directory, 'paas-workshop.json');
  for (const content of ['export SECRET=$(false)', '{}', '{"version":2,"values":{}}',
    JSON.stringify({ version: 1, values: { ...values, UNEXPECTED: 'fixture' } })]) {
    fs.writeFileSync(file, content);
    assert.throws(() => readState(directory));
  }
  assert.throws(() => validate({ ...values, WORKSHOP_REPO_DIR: '/nonexistent-fixture' }, directory), /missing/);
  assert.throws(() => validate({ ...values, PARAM_FILE: '/outside-fixture/file' }, directory), /mismatch/);
  assert.throws(() => validate({ ...values, TENANT_ID: 'placeholder' }, directory), /UUID/);
  assert.throws(() => validate({ ...values, PARAM_FILE: path.join(directory, 'paas-workshop.json') }, directory), /bicepparam/);
  assert.throws(() => validate({ ...values, BACKEND_CLIENT_ID: values.SUBSCRIPTION_ID,
    FRONTEND_CLIENT_ID: values.SUBSCRIPTION_ID }, directory), /distinct/);
});

test('stages require identity/deployment values and reject unsafe hostnames', (t) => {
  const { directory, values } = fixture(t);
  assert.throws(() => validate(values, directory, 'identity'), /BACKEND_CLIENT_ID/);
  const identity = {
    ...values, BACKEND_CLIENT_ID: '00000000-0000-0000-0000-000000000003',
    FRONTEND_CLIENT_ID: '00000000-0000-0000-0000-000000000004',
    ACCESS_SCOPE_ID: '00000000-0000-0000-0000-000000000005',
  };
  validate(identity, directory, 'identity');
  assert.throws(() => validate(identity, directory, 'deployed'), /APP_SERVICE_NAME/);
  assert.throws(() => validate({ ...identity, SWA_HOSTNAME: 'fixture@example.invalid' }, directory), /SWA_HOSTNAME/);
});

test('legacy state, lock contention, unsafe directories and foreign checkouts are rejected', (t) => {
  const { directory, values } = fixture(t);
  const legacy = path.join(directory, 'paas-workshop.env');
  fs.writeFileSync(legacy, 'export RESOURCE_GROUP=legacy');
  assert.throws(() => writeState(directory, values, true), /Legacy/);
  assert.equal(fs.existsSync(path.join(directory, 'paas-workshop.json')), false);
  fs.unlinkSync(legacy);
  const lock = path.join(directory, '.paas-workshop.lock');
  fs.writeFileSync(lock, 'fixture');
  assert.throws(() => writeState(directory, values, true), /EEXIST/);
  assert.equal(fs.readFileSync(lock, 'utf8'), 'fixture');
  fs.unlinkSync(lock);
  for (const unsafe of ['/', os.homedir(), repository, path.join(repository, 'materials')]) {
    assert.throws(() => validate({ ...values, WORKSHOP_STATE_DIR: unsafe,
      PARAM_FILE: path.join(unsafe, 'dev.local.bicepparam') }, unsafe), /dedicated state directory/);
  }
  const alias = path.join(directory, 'repository-alias');
  fs.symlinkSync(repository, alias, 'dir');
  const aliasedState = path.join(alias, 'new-state-fixture');
  assert.throws(() => validate({ ...values, WORKSHOP_STATE_DIR: aliasedState,
    PARAM_FILE: path.join(aliasedState, 'dev.local.bicepparam') }, aliasedState), /dedicated state directory/);
  const foreign = path.join(directory, 'foreign-checkout');
  for (const file of ['README.md', 'materials/bicep/main.bicep', 'scripts/workshop-state.sh']) {
    fs.mkdirSync(path.dirname(path.join(foreign, file)), { recursive: true });
    fs.writeFileSync(path.join(foreign, file), '');
  }
  assert.throws(() => validate({ ...values, WORKSHOP_REPO_DIR: foreign }, directory), /helper checkout/);
});

test('save rejects wrong, disabled, unreadable and malformed Azure contexts without changing state', (t) => {
  const { directory, values } = fixture(t);
  writeState(directory, values, true);
  const previous = fs.readFileSync(path.join(directory, 'paas-workshop.json'), 'utf8');
  const script = `
    source "$HELPER" || exit 1
    az() { if [ "$FIXTURE_ACCOUNT" = failure ]; then return 9; fi; printf '%s' "$FIXTURE_ACCOUNT"; }
    workshop_state_save base
  `;
  for (const account of ['failure', '{', '{}',
    JSON.stringify({ id: values.TENANT_ID, tenantId: values.TENANT_ID, state: 'Enabled' }),
    JSON.stringify({ id: values.SUBSCRIPTION_ID, tenantId: values.TENANT_ID, state: 'Disabled' })]) {
    const result = spawnSync('bash', ['-c', script], { encoding: 'utf8', env: {
      ...process.env, ...values, HELPER: path.join(repository, 'scripts/workshop-state.sh'),
      FIXTURE_ACCOUNT: account,
    } });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readFileSync(path.join(directory, 'paas-workshop.json'), 'utf8'), previous);
  }
});

test('reconnect loads data without executing shell strings, clears stale optional values, and checks Azure context', (t) => {
  const { directory, values } = fixture(t);
  const oddPath = path.join(directory, "repo with spaces '$(touch SHOULD_NOT_EXIST)'");
  fs.symlinkSync(repository, oddPath, 'dir');
  writeState(directory, { ...values, WORKSHOP_REPO_DIR: oddPath }, true);
  const script = `
    source "$HELPER"
    az() { printf '%s' "$FIXTURE_ACCOUNT"; }
    export BACKEND_CLIENT_ID=stale
    workshop_state_load base || exit 1
    [ "$BACKEND_CLIENT_ID" = "" ] || exit 2
    [ "$RESOURCE_GROUP" = "rg-blogapp-B-paas-workshop" ] || exit 3
    printf '%s' "$WORKSHOP_REPO_DIR"
  `;
  const env = { ...process.env, WORKSHOP_STATE_DIR: directory,
    HELPER: path.join(repository, 'scripts/workshop-state.sh'),
    FIXTURE_ACCOUNT: JSON.stringify({ id: values.SUBSCRIPTION_ID, tenantId: values.TENANT_ID, state: 'Enabled' }) };
  const result = spawnSync('bash', ['-c', script], { env, encoding: 'utf8', cwd: directory });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, oddPath);
  assert.equal(fs.existsSync(path.join(directory, 'SHOULD_NOT_EXIST')), false);
  assert.equal(fs.existsSync(path.join(repository, 'SHOULD_NOT_EXIST')), false);
  const mismatch = spawnSync('bash', ['-c', script], {
    env: { ...env, FIXTURE_ACCOUNT: JSON.stringify({ id: values.TENANT_ID, tenantId: values.TENANT_ID, state: 'Enabled' }) },
    encoding: 'utf8',
  });
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /context mismatch/);
});
