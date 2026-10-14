const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const repository = path.resolve(__dirname, '../..');
const subscription = '00000000-0000-0000-0000-000000000001';
const user = '00000000-0000-0000-0000-000000000002';

function procedure() {
  const page = fs.readFileSync(path.join(repository, 'materials/docs/learner/day-0-prerequisites.ja.md'), 'utf8');
  const section = page.split('### サブスクリプションの Owner を確認する')[1].split('## 3.')[0];
  return section.match(/```bash\n([\s\S]*?)```/)[1];
}

function fixture(t, assignments, failure = '') {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'paas-owner-prerequisite-')));
  t.after(() => fs.rmSync(root, { recursive: true }));
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  const log = path.join(root, 'calls.jsonl');
  fs.writeFileSync(path.join(bin, 'az'), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALL_LOG, JSON.stringify(args) + '\\n');
if (args[0] === process.env.FAILURE) {
  console.error('Fixture read denied');
  process.exit(9);
}
if (args[0] === 'account') console.log('${subscription}');
else if (args[0] === 'ad' && args[1] === 'signed-in-user') console.log('${user}');
else if (args[0] === 'role' && args[1] === 'assignment' && args[2] === 'list') {
  console.log(process.env.ASSIGNMENTS);
} else {
  console.error('Unexpected write or command');
  process.exit(10);
}
`, { mode: 0o755 });
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    CALL_LOG: log, ASSIGNMENTS: JSON.stringify(assignments), FAILURE: failure };
  const run = spawnSync('bash', ['-c', procedure()], { env, encoding: 'utf8', timeout: 10000 });
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse) : [];
  return { run, calls };
}

test('exact learner Owner check reads the current subscription with group and inherited assignments', t => {
  const { run, calls } = fixture(t, [{ roleDefinitionName: 'Owner' }, { roleDefinitionName: 'Reader' }]);
  assert.equal(run.status, 0, run.stderr);
  const command = calls.find(args => args[0] === 'role');
  assert.equal(command[command.indexOf('--assignee') + 1], user);
  assert.equal(command[command.indexOf('--scope') + 1], `/subscriptions/${subscription}`);
  assert(command.includes('--include-inherited'));
  assert(command.includes('--include-groups'));
  assert(run.stdout.includes('Owner 割り当てを確認しました'));
  assert.equal(calls.length, 3);
});

test('Contributor-only, absent and invalid assignment results stop instead of claiming Owner', t => {
  for (const assignments of [
    [{ roleDefinitionName: 'Contributor' }], [], null, { roleDefinitionName: 'Owner' },
  ]) {
    const { run, calls } = fixture(t, assignments);
    assert.notEqual(run.status, 0);
    assert(run.stderr.includes('Owner を確認できません'));
    assert(!run.stdout.includes('Owner 割り当てを確認しました'));
    assert(calls.every(args => args[0] !== 'role' || args[2] === 'list'));
  }
});

test('CLI identity and assignment read errors fail explicitly without writes', t => {
  for (const failure of ['account', 'ad', 'role']) {
    const { run, calls } = fixture(t, [{ roleDefinitionName: 'Owner' }], failure);
    assert.notEqual(run.status, 0);
    assert(run.stderr.includes('Fixture read denied'));
    assert(!run.stdout.includes('Owner 割り当てを確認しました'));
    assert(calls.every(args => !args.includes('create') && !args.includes('delete')));
  }
});
