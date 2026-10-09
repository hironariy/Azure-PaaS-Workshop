const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const repository = path.resolve(__dirname, '../..');
const subscription = '00000000-0000-0000-0000-000000000001';
const tenant = '00000000-0000-0000-0000-000000000002';
const backend = '00000000-0000-0000-0000-000000000003';
const frontend = '00000000-0000-0000-0000-000000000004';
const group = 'rg-blogapp-B-paas-workshop';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paas-deployment-'));
  t.after(() => fs.rmSync(root, { recursive: true }));
  const checkout = path.join(root, "checkout with spaces 'quoted'");
  const state = path.join(root, 'state');
  const bin = path.join(root, 'bin');
  for (const directory of [state, bin, path.join(checkout, 'scripts'), path.join(checkout, 'materials/bicep'),
    path.join(checkout, 'materials/backend'), path.join(checkout, 'materials/frontend')]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  for (const name of ['workshop-state.sh', 'workshop-state.cjs', 'workshop-deploy-common.sh',
    'deploy-backend.sh', 'deploy-frontend.sh', 'cleanup-workshop.sh', 'workshop-setup.sh',
    'check-role-assignment-permission.cjs']) {
    fs.copyFileSync(path.join(repository, 'scripts', name), path.join(checkout, 'scripts', name));
  }
  fs.writeFileSync(path.join(checkout, 'README.md'), 'Owned fixture');
  fs.writeFileSync(path.join(checkout, 'materials/bicep/main.bicep'), '');
  for (const app of ['backend', 'frontend']) {
    fs.writeFileSync(path.join(checkout, 'materials', app, 'package.json'), '{"name":"fixture"}');
    fs.writeFileSync(path.join(checkout, 'materials', app, 'package-lock.json'), '{"lockfileVersion":3}');
  }
  fs.writeFileSync(path.join(checkout, 'materials/frontend/staticwebapp.config.json'), '{}');
  const values = {
    WORKSHOP_REPO_DIR: checkout, WORKSHOP_STATE_DIR: state,
    LOCATION: 'japaneast', SWA_LOCATION: 'eastasia', BASE_NAME: 'blogapp', GROUP_ID: 'B',
    RESOURCE_GROUP: group, PARAM_FILE: path.join(state, 'dev.local.bicepparam'),
    SUBSCRIPTION_ID: subscription, TENANT_ID: tenant, BACKEND_CLIENT_ID: backend,
    FRONTEND_CLIENT_ID: frontend, ACCESS_SCOPE_ID: '00000000-0000-0000-0000-000000000005',
    APP_SERVICE_NAME: 'app-fixture', SWA_NAME: 'swa-fixture', SWA_HOSTNAME: 'fixture.azurestaticapps.net',
  };
  fs.writeFileSync(path.join(state, 'paas-workshop.json'), JSON.stringify({ version: 1, values }), { mode: 0o600 });
  const mock = `#!/usr/bin/env node
const fs=require('node:fs'), path=require('node:path');
const tool=path.basename(process.argv[1]), args=process.argv.slice(2), scenario=process.env.SCENARIO;
fs.appendFileSync(process.env.MOCK_LOG,JSON.stringify({tool,args,hasToken:!!process.env.SWA_CLI_DEPLOYMENT_TOKEN})+'\\n');
const fail=(message)=>{console.error(message);process.exit(9)};
const result=(value)=>{console.log(typeof value==='string'?value:JSON.stringify(value));process.exit(0)};
const marker=(name)=>path.join(process.env.MOCK_ROOT,name);
if(tool==='sleep')process.exit(0);
if(tool==='npm'){
 if(scenario==='build-fail')fail('Build failed fixture');
 if(args.includes('build')){
  if(process.cwd().endsWith('frontend')){
   fs.mkdirSync('dist/assets',{recursive:true});fs.writeFileSync('dist/assets/app.js','production fixture');
   fs.writeFileSync('dist/index.html','<script>window.__APP_CONFIG__=null;</script>');
  }else{
   const out=args[args.indexOf('--outDir')+1];
   fs.mkdirSync(path.join(out,'src'),{recursive:true});fs.writeFileSync(path.join(out,'src/app.js'),'fixture');
  }
 }
 process.exit(0);
}
if(tool==='swa'){
 if(!process.env.SWA_CLI_DEPLOYMENT_TOKEN)fail('Missing deployment token');
 process.exit(0);
}
if(tool==='curl'){
 const output=args[args.indexOf('--output')+1];
 fs.writeFileSync(output,scenario==='html'?'private fixture body':
  JSON.stringify({status:scenario==='unhealthy'?'unhealthy':'healthy'}));
 if(scenario==='network'){process.stdout.write('000');fail('Transport failure fixture')}
 result(scenario==='http503'?'503':'200');
}
if(tool!=='az')fail('Unexpected mock tool');
const command=args.slice(0,2).join(' ');
if(command==='account show'){
 const query=args[args.indexOf('--query')+1];
 if(query==='id')result('${subscription}');
 if(query==='tenantId')result('${tenant}');
 if(query==='name')result('Owned fixture subscription');
 result({id:'${subscription}',tenantId:'${tenant}',state:'Enabled',environmentName:'AzureCloud'});
}
if(command==='group exists'){
 if(scenario==='group-lookup-fail')fail('Group lookup rejected');
 result(fs.existsSync(marker('group-absent'))?'false':'true');
}
if(command==='group show')result({Workshop:'Azure-PaaS-Workshop',GroupId:scenario==='wrong-tag'?'A':'B'});
if(command==='group wait'){
 if(scenario==='wait-fail')fail('Group deletion timeout');
 fs.writeFileSync(marker('group-absent'),'');process.exit(0);
}
if(command==='group delete'||command==='group create'||command==='resource list')process.exit(0);
if(args[0]==='rest')result({value:[{actions:scenario==='no-permission'?['Microsoft.Resources/*']:['*'],notActions:[]}]});
if(command==='webapp show')result('app-fixture-hash.japaneast.azurewebsites.net');
if(command==='webapp config')process.exit(0);
if(command==='webapp deploy'){
 if(args.includes('--help'))result('--track-status');
 if(scenario==='upload-fail')fail('Upload rejected fixture');
 result({status:'accepted'});
}
if(command==='staticwebapp show')result('fixture.azurestaticapps.net');
if(command==='staticwebapp secrets'){
 if(scenario==='token-fail')fail('Token lookup rejected');
 result('SENTINEL_DEPLOYMENT_TOKEN_FIXTURE');
}
if(command==='role assignment'){
 if(scenario==='role-fail')fail('Role assignment rejected fixture');
 process.exit(0);
}
if(args[0]==='ad'){
 if(args[1]==='signed-in-user')result('fixture-owner');
 if(args[1]==='sp'&&args[2]==='list')result(['fixture-sp']);
 if(args[1]==='app'&&args[2]==='owner')result(scenario==='not-owner'?[]:[{id:'fixture-owner'}]);
 if(args[1]==='app'&&args[2]==='list'){
  if(scenario==='app-lookup-fail')fail('Application lookup rejected');
  const filter=args[args.indexOf('--filter')+1]||'';
  const id=filter.includes('${frontend}')?'${frontend}':'${backend}';
  result(fs.existsSync(marker(id))?[]:[id]);
 }
 if(args[1]==='app'&&args[2]==='delete'){
  fs.writeFileSync(marker(args[args.indexOf('--id')+1]),'');process.exit(0);
 }
 if(args[1]==='app'&&args[2]==='federated-credential'){
  if(args[3]==='list')result([]);process.exit(0);
 }
}
fail('Unexpected Azure mock command: '+args.join(' '));
`;
  for (const tool of ['az', 'npm', 'swa', 'curl', 'sleep']) {
    fs.writeFileSync(path.join(bin, tool), mock, { mode: 0o755 });
  }
  const env = { ...process.env, ...values, PATH: `${bin}:${process.env.PATH}`,
    MOCK_ROOT: root, MOCK_LOG: path.join(root, 'calls.jsonl'), TMPDIR: root };
  const run = (script, args = [], scenario = '', input = '') =>
    spawnSync('bash', [path.join(checkout, 'scripts', script), ...args], {
      env: { ...env, SCENARIO: scenario }, encoding: 'utf8', input, timeout: 15000,
    });
  const calls = () => fs.existsSync(env.MOCK_LOG)
    ? fs.readFileSync(env.MOCK_LOG, 'utf8').trim().split('\n').map((line) => JSON.parse(line)) : [];
  return { checkout, env, run, calls };
}

test('backend isolates its package, uses explicit subscription and retains unrelated artifacts', (t) => {
  const { checkout, run, calls } = fixture(t);
  const backendDir = path.join(checkout, 'materials/backend');
  fs.writeFileSync(path.join(backendDir, 'deploy.zip'), 'pre-existing fixture');
  fs.mkdirSync(path.join(backendDir, 'deploy-package'));
  const result = run('deploy-backend.sh', [group, 'app-fixture']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Upload and readiness checks passed/);
  assert.equal(fs.readFileSync(path.join(backendDir, 'deploy.zip'), 'utf8'), 'pre-existing fixture');
  assert.equal(fs.existsSync(path.join(backendDir, 'deploy-package')), true);
  assert.equal(fs.readdirSync(backendDir).some((name) => name.startsWith('.deploy-')), false);
  for (const call of calls().filter((call) => call.tool === 'az' && call.args[0] === 'webapp' && !call.args.includes('--help'))) {
    assert.equal(call.args[call.args.indexOf('--subscription') + 1], subscription);
  }
  assert(calls().some((call) => call.tool === 'npm' && call.args.join(' ') === 'ci --omit=dev'));
});

test('backend target mismatch, build failure and rejected upload cannot report success', (t) => {
  for (const scenario of ['target', 'build-fail', 'upload-fail']) {
    const { checkout, run, calls } = fixture(t);
    const result = run('deploy-backend.sh', [scenario === 'target' ? 'rg-other' : group, 'app-fixture'], scenario);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout, /Upload and readiness checks passed/);
    assert.equal(fs.readdirSync(path.join(checkout, 'materials/backend')).some((name) => name.startsWith('.deploy-')), false);
    if (scenario === 'target') assert.equal(calls().some((call) => call.tool === 'npm' || call.args[0] === 'webapp'), false);
  }
});

test('health requires bounded transport and healthy JSON, not merely HTTP 200', (t) => {
  for (const scenario of ['', 'html', 'unhealthy', 'network', 'http503']) {
    const { checkout, env, calls } = fixture(t);
    const result = spawnSync('bash', ['-c',
      'source "$COMMON"; workshop_wait_for_health https://fixture.azurewebsites.net/health 1 0'], {
      env: { ...env, SCENARIO: scenario, COMMON: path.join(checkout, 'scripts/workshop-deploy-common.sh') },
      encoding: 'utf8',
    });
    assert.equal(result.status === 0, scenario === '', result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, /private fixture body|000000/);
    const probe = calls().find((call) => call.tool === 'curl');
    assert.equal(probe.args[probe.args.indexOf('--max-time') + 1], '10');
    assert.equal(probe.args[probe.args.indexOf('--connect-timeout') + 1], '5');
    assert.equal(calls().some((call) => call.tool === 'sleep'), false);
  }
});

test('frontend injects saved public IDs and never prints or passes a token as an argument', (t) => {
  const { checkout, run, calls } = fixture(t);
  const result = run('deploy-frontend.sh', [group]);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout + result.stderr, /SENTINEL_DEPLOYMENT_TOKEN_FIXTURE/);
  assert(fs.readFileSync(path.join(checkout, 'materials/frontend/dist/index.html'), 'utf8').includes(frontend));
  const deploy = calls().find((call) => call.tool === 'swa');
  assert.equal(deploy.hasToken, true);
  assert.deepEqual(deploy.args, ['deploy', './dist', '--env', 'production']);
  assert(calls().filter((call) => call.tool !== 'swa').every((call) => !call.hasToken));
});

test('backend unhealthy responses exhaust exactly 30 attempts without a success message', (t) => {
  const { run, calls } = fixture(t);
  const result = run('deploy-backend.sh', [group, 'app-fixture'], 'unhealthy');
  assert.notEqual(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Upload and readiness checks passed/);
  assert.match(result.stderr, /30 attempts/);
  assert.equal(calls().filter((call) => call.tool === 'curl').length, 30);
  assert.equal(calls().filter((call) => call.tool === 'sleep' && call.args[0] === '15').length, 29);
});

test('exact learner parameter snippet hides generated secrets and preserves them on repeat', (t) => {
  const { checkout, env } = fixture(t);
  fs.copyFileSync(path.join(repository, 'materials/bicep/dev.bicepparam'),
    path.join(checkout, 'materials/bicep/dev.bicepparam'));
  const document = fs.readFileSync(path.join(repository, 'materials/docs/learner/day-1-deploy-infrastructure.ja.md'), 'utf8');
  const snippet = document.match(/node <<'NODE' \|\| exit 1\n([\s\S]*?)\nNODE/);
  assert(snippet, 'Exact parameter creation snippet must exist');
  const execute = () => spawnSync(process.execPath, ['-'], { env, input: snippet[1], encoding: 'utf8' });
  const first = execute();
  assert.equal(first.status, 0, first.stderr);
  const contents = fs.readFileSync(env.PARAM_FILE, 'utf8');
  const relative = path.relative(env.WORKSHOP_STATE_DIR, path.join(checkout, 'materials/bicep/main.bicep'))
    .split(path.sep).join('/').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  assert(contents.includes(`using '${relative}'`));
  const password = contents.match(/param cosmosDbAdminPassword = '(Aa1_[A-Za-z0-9_-]{32})'/);
  assert(password, 'Generated password must satisfy length/character requirements');
  assert.doesNotMatch(first.stdout + first.stderr, new RegExp(password[1]));
  const repeat = execute();
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.equal(fs.readFileSync(env.PARAM_FILE, 'utf8'), contents);
  assert.equal(fs.statSync(env.PARAM_FILE).mode & 0o777, 0o600);
  fs.unlinkSync(env.PARAM_FILE);
  const unrelated = path.join(env.WORKSHOP_STATE_DIR, 'unrelated-file');
  fs.writeFileSync(unrelated, 'owned fixture unrelated data');
  fs.symlinkSync(unrelated, env.PARAM_FILE);
  assert.notEqual(execute().status, 0);
  assert.equal(fs.readFileSync(unrelated, 'utf8'), 'owned fixture unrelated data');
});

test('frontend token lookup failure is visible and never calls SWA or reports completion', (t) => {
  const { run, calls } = fixture(t);
  const result = run('deploy-frontend.sh', [group], 'token-fail');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Token lookup rejected/);
  assert.doesNotMatch(result.stdout, /Deployment Complete/);
  assert.equal(calls().some((call) => call.tool === 'swa'), false);
});

test('cleanup validates ownership, waits for actual absence and retains local state', (t) => {
  const { env, run, calls } = fixture(t);
  const result = run('cleanup-workshop.sh', [], '', `${subscription}/${group}\n`);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /confirmed absent/);
  assert(fs.existsSync(path.join(env.WORKSHOP_STATE_DIR, 'paas-workshop.json')));
  const deletion = calls().find((call) => call.args[0] === 'group' && call.args[1] === 'delete');
  assert.equal(deletion.args[deletion.args.indexOf('--subscription') + 1], subscription);
  const wait = calls().findIndex((call) => call.args[0] === 'group' && call.args[1] === 'wait');
  const appDeletion = calls().findIndex((call) => call.args.slice(0, 3).join(' ') === 'ad app delete');
  assert(wait >= 0 && appDeletion > wait);
});

test('cleanup rejects unknown targets and lookup errors; failed wait preserves applications', (t) => {
  for (const scenario of ['wrong-tag', 'not-owner', 'app-lookup-fail', 'group-lookup-fail', 'cancel', 'wait-fail']) {
    const { env, run, calls } = fixture(t);
    const result = run('cleanup-workshop.sh', [], scenario,
      scenario === 'cancel' ? 'wrong target\n' : `${subscription}/${group}\n`);
    assert.notEqual(result.status, 0, scenario);
    assert.doesNotMatch(result.stdout, /confirmed absent/);
    assert(fs.existsSync(path.join(env.WORKSHOP_STATE_DIR, 'paas-workshop.json')));
    assert.equal(calls().some((call) => call.args.slice(0, 3).join(' ') === 'ad app delete'), false);
    if (scenario !== 'wait-fail') assert.equal(calls().some((call) => call.args.slice(0, 2).join(' ') === 'group delete'), false);
  }
});

test('optional setup stops on missing RBAC, rejected app lookup or failed role assignment', (t) => {
  for (const scenario of ['no-permission', 'app-lookup-fail', 'role-fail']) {
    const { checkout, env, calls } = fixture(t);
    const result = spawnSync('bash', ['-c', 'source "$SETUP"; create_azure_resources'], {
      env: { ...env, SCENARIO: scenario, SETUP: path.join(checkout, 'scripts/workshop-setup.sh'),
        APP_NAME: 'owned-fixture', LOCATION: 'japaneast', GITHUB_USER: 'fixture', REPO_NAME: 'fixture' },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /Contributor role assigned|Azure identity setup completed/);
    if (scenario === 'no-permission') assert.equal(calls().some((call) => call.args.slice(0, 2).join(' ') === 'group create'), false);
    if (scenario === 'app-lookup-fail') assert(calls().some((call) => call.args.slice(0, 3).join(' ') === 'ad app list'));
    if (scenario === 'role-fail') assert(calls().some((call) => call.args.slice(0, 3).join(' ') === 'role assignment create'));
  }
});
