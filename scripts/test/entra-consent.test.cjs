const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const repository = path.resolve(__dirname, '../..');
const tenant = '00000000-0000-0000-0000-000000000001';
const user = '00000000-0000-0000-0000-000000000002';
const backend = '00000000-0000-0000-0000-000000000003';
const frontend = '00000000-0000-0000-0000-000000000004';
const resource = '00000000-0000-0000-0000-000000000005';
const client = '00000000-0000-0000-0000-000000000006';
const grant = { clientId: client, resourceId: resource, consentType: 'Principal',
  principalId: user, scope: 'access_as_user' };

function procedure() {
  const page = fs.readFileSync(path.join(repository, 'materials/docs/learner/day-0-entra-id.ja.md'), 'utf8');
  const section = page.split('## 4. Application Developer として本人だけに同意する')[1].split('## 5.')[0];
  return section.match(/```bash\n([\s\S]*?)```/)[1];
}

function fixture(t, scenario = '', grants = []) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'paas-consent-')));
  t.after(() => fs.rmSync(root, { recursive: true }));
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  const log = path.join(root, 'calls.jsonl');
  const state = path.join(root, 'grants.json');
  fs.writeFileSync(state, JSON.stringify(grants));
  fs.writeFileSync(path.join(bin, 'az'), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2), scenario = process.env.SCENARIO;
const value = name => args[args.indexOf(name) + 1];
fs.appendFileSync(process.env.CALL_LOG, JSON.stringify(args) + '\\n');
const fail = message => { console.error(message); process.exit(9); };
if (args[0] === 'account') {
  if (scenario === 'account-failure') fail('Account read denied');
  console.log(JSON.stringify({tenantId: scenario === 'wrong-tenant' ? '${backend}' : '${tenant}',
    user: {type: scenario === 'service-login' ? 'servicePrincipal' : 'user'}}));
} else if (args[1] === 'signed-in-user') {
  if (scenario === 'user-failure') fail('User read denied');
  console.log(scenario === 'empty-user' ? '' : '${user}');
} else if (args.includes('owner')) {
  if (scenario === 'owner-failure') fail('Owner read denied');
  console.log(JSON.stringify([{id: scenario === 'not-owner' ? '${tenant}' : '${user}'}]));
} else if (args[1] === 'sp') {
  if (args[2] === 'list') {
    if (scenario === 'sp-list-failure') fail('Service principal read denied');
    console.log(JSON.stringify(['missing-sp', 'sp-create-failure'].includes(scenario) ? [] : [{id: '${client}'}]));
  } else if (args[2] === 'create') {
    if (scenario === 'sp-create-failure') fail('Service principal create denied');
  } else if (args[2] === 'show') {
    console.log(scenario === 'empty-sp' ? '' : value('--id') === '${backend}' ? '${resource}' : '${client}');
  } else fail('Unexpected service principal command');
} else if (args[2] === 'permission') {
  if (args[3] === 'list-grants') {
    if (scenario === 'grant-read-failure') fail('Grant read denied');
    console.log(fs.readFileSync(process.env.GRANT_STATE, 'utf8'));
  } else if (args[3] === 'grant') {
    if (scenario === 'grant-denied') fail('Authorization_RequestDenied');
    const grants = JSON.parse(fs.readFileSync(process.env.GRANT_STATE, 'utf8'));
    grants.push({clientId: scenario === 'wrong-client' ? '${tenant}' : '${client}',
      resourceId: scenario === 'wrong-resource' ? '${tenant}' : '${resource}',
      consentType: scenario === 'all-principals' ? 'AllPrincipals' : value('--consent-type'),
      principalId: scenario === 'wrong-principal' ? '${tenant}' : value('--principal-id'),
      scope: scenario === 'verification-failure' ? 'other_scope' : value('--scope')});
    fs.writeFileSync(process.env.GRANT_STATE, JSON.stringify(grants));
  } else fail('Unexpected permission command');
} else fail('Unexpected Azure CLI command');
`, { mode: 0o755 });
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    TENANT_ID: tenant, BACKEND_CLIENT_ID: backend, FRONTEND_CLIENT_ID: frontend,
    CALL_LOG: log, GRANT_STATE: state, SCENARIO: scenario };
  const calls = () => fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse) : [];
  const run = () => spawnSync('bash', ['-c', procedure()], { env, encoding: 'utf8', timeout: 10000 });
  return { env, calls, run, state };
}

const writes = calls => calls.filter(args => args.includes('create') || args[3] === 'grant');

test('exact Day 0 command grants only the signed-in learner and verifies the grant', t => {
  const f = fixture(t, 'missing-sp');
  const run = f.run();
  assert.equal(run.status, 0, run.stderr);
  const calls = f.calls();
  assert.equal(calls.filter(args => args[1] === 'sp' && args[2] === 'create').length, 2);
  const command = calls.find(args => args[3] === 'grant');
  for (const [flag, expected] of [
    ['--id', frontend], ['--api', backend], ['--scope', 'access_as_user'],
    ['--consent-type', 'Principal'], ['--principal-id', user],
  ]) assert.equal(command[command.indexOf(flag) + 1], expected);
  assert(!command.includes('AllPrincipals'));
  assert.equal(calls.filter(args => args[3] === 'list-grants').length, 2);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.state, 'utf8')), [grant]);
  assert(run.stdout.includes('本人の Principal grant を確認しました。'));
});

test('rerunning Day 0 reuses a complete self-grant without writes', t => {
  const f = fixture(t, '', [{ ...grant, scope: 'other_scope access_as_user' }]);
  const run = f.run();
  assert.equal(run.status, 0, run.stderr);
  assert.equal(writes(f.calls()).length, 0);
  assert(run.stdout.includes('再利用'));
});

test('other-user, all-user, incomplete and duplicate same-pair grants are never replaced', t => {
  for (const grants of [
    [{ ...grant, principalId: tenant }],
    [{ ...grant, consentType: 'AllPrincipals', principalId: null }],
    [{ ...grant, scope: 'not_access_as_user' }],
    [grant, { ...grant, principalId: tenant }],
    [grant, grant],
  ]) {
    const f = fixture(t, '', grants);
    const run = f.run();
    assert.notEqual(run.status, 0);
    assert(run.stderr.includes('削除・置換しません'));
    assert.equal(writes(f.calls()).length, 0);
    assert.deepEqual(JSON.parse(fs.readFileSync(f.state, 'utf8')), grants);
  }
});

test('grants for another resource are preserved when creating the target grant', t => {
  const other = { ...grant, resourceId: tenant };
  const f = fixture(t, '', [other]);
  const run = f.run();
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.state, 'utf8')), [other, grant]);
});

test('identity, tenant, ownership and lookup failures stop before any writes', t => {
  for (const scenario of [
    'account-failure', 'wrong-tenant', 'service-login', 'user-failure', 'empty-user',
    'owner-failure', 'not-owner', 'sp-list-failure', 'empty-sp', 'grant-read-failure',
  ]) {
    const f = fixture(t, scenario);
    const run = f.run();
    assert.notEqual(run.status, 0, scenario);
    assert.equal(writes(f.calls()).length, 0, scenario);
    assert(!run.stdout.includes('本人の Principal grant を確認しました。'));
  }
  const f = fixture(t);
  f.env.FRONTEND_CLIENT_ID = 'invalid';
  assert.notEqual(f.run().status, 0);
  assert.equal(f.calls().length, 0);
});

test('malformed grant responses cannot be interpreted as no existing grant', t => {
  for (const grants of [{ value: [] }, null, [{}], [{ ...grant, scope: null }]]) {
    const f = fixture(t, '', grants);
    const run = f.run();
    assert.notEqual(run.status, 0);
    assert.equal(writes(f.calls()).length, 0);
    assert(run.stderr.includes('読み取り結果が不正'));
  }
});

test('write denial and mismatched verified grant fields cannot report success', t => {
  for (const scenario of [
    'sp-create-failure', 'grant-denied', 'verification-failure',
    'wrong-client', 'wrong-resource', 'wrong-principal', 'all-principals',
  ]) {
    const f = fixture(t, scenario);
    const run = f.run();
    assert.notEqual(run.status, 0);
    assert(!run.stdout.includes('本人の Principal grant を確認しました。'));
    if (scenario === 'sp-create-failure') {
      assert(run.stderr.includes('Service principal create denied'));
      assert(!f.calls().some(args => args[3] === 'grant'));
    } else if (scenario === 'grant-denied') assert(run.stderr.includes('Authorization_RequestDenied'));
    else assert(run.stderr.includes('Day 1 に進まない'));
  }
});
