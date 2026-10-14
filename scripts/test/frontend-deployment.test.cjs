const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const repository = path.resolve(__dirname, '../..');
const client = '00000000-0000-0000-0000-000000000004';
const object = '00000000-0000-0000-0000-000000000006';
const token = 'FIXTURE_SITE_TOKEN_DO_NOT_PRINT_1234567';

function fixture(t, scenario = '') {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'paas-cli-procedure-')));
  t.after(() => fs.rmSync(root, { recursive: true }));
  const bin = path.join(root, 'bin');
  const checkout = path.join(root, 'checkout');
  const state = path.join(root, 'state');
  for (const dir of [bin, state, path.join(checkout, 'scripts'), path.join(checkout, 'materials/frontend')]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(path.join(repository, 'scripts/deploy-frontend.sh'), path.join(checkout, 'scripts/deploy-frontend.sh'));
  fs.copyFileSync(path.join(repository, 'materials/frontend/staticwebapp.config.json'),
    path.join(checkout, 'materials/frontend/staticwebapp.config.json'));
  fs.writeFileSync(path.join(checkout, 'materials/frontend/package.json'), '{"name":"fixture"}');
  fs.writeFileSync(path.join(state, 'deploy-frontend.local.env'),
    `ENTRA_TENANT_ID="00000000-0000-0000-0000-000000000001"\nENTRA_FRONTEND_CLIENT_ID="${client}"\nENTRA_BACKEND_CLIENT_ID="00000000-0000-0000-0000-000000000005"\n`);
  const log = path.join(root, 'calls.jsonl');
  const app = { id: object, appId: client, spa: {
    redirectUris: ['http://localhost:4280', 'https://existing.azurestaticapps.net'],
  } };
  const program = `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path');
const tool=path.basename(process.argv[1]),args=process.argv.slice(2);
fs.appendFileSync(process.env.CALL_LOG,JSON.stringify({tool,args,cwd:process.cwd(),hasToken:process.env.SWA_CLI_DEPLOYMENT_TOKEN==='${token}'})+'\\n');
if(tool==='npm'&&args.includes('build')){
 fs.mkdirSync('dist/assets',{recursive:true});
 fs.writeFileSync('dist/index.html','<script>window.__APP_CONFIG__=null;</script>');
 fs.writeFileSync('dist/assets/app.js','production fixture');
}
if(tool==='swa'&&process.env.SCENARIO==='upload-failure')process.exit(9);
if(tool==='curl'){
 if(args.includes('--output')){
  fs.writeFileSync(args[args.indexOf('--output')+1],process.env.SCENARIO==='unchanged-site'?'old deployment':fs.readFileSync('dist/index.html'));
 }else if(process.env.SCENARIO==='api-failure')process.exit(22);
 else console.log(JSON.stringify({status:process.env.SCENARIO==='unhealthy-api'?'unhealthy':'healthy'}));
}
if(tool==='az'){
 if(args[0]==='account'){
  console.log(JSON.stringify({id:process.env.SUBSCRIPTION_ID,tenantId:process.env.SCENARIO==='wrong-tenant'?'wrong':process.env.TENANT_ID}));
 }else if(args[0]==='ad'){
  if(args.includes('--subscription')){console.error('unrecognized arguments: --subscription');process.exit(2);}
  if(process.env.SCENARIO==='app-read-failure')process.exit(9);
  const app=JSON.parse(process.env.APP_JSON);
  if(process.env.SCENARIO==='wrong-client')app.appId='00000000-0000-0000-0000-000000000009';
  if(process.env.SCENARIO==='invalid-uris')app.spa.redirectUris={unexpected:true};
  console.log(JSON.stringify(app));
 }else if(args[0]==='staticwebapp'){
  if(args[1]==='list')console.log(JSON.stringify(process.env.SCENARIO==='multiple-sites'?['swa-one','swa-two']:['swa-fixture']));
  else if(args[1]==='show')console.log('fixture.azurestaticapps.net');
  else if(args[1]==='secrets')console.log('${token}');
 }
}
`;
  for (const name of ['az', 'npm', 'swa', 'curl', 'sleep']) fs.writeFileSync(path.join(bin, name), program, { mode: 0o755 });
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    WORKSHOP_STATE_DIR: state, CALL_LOG: log, SCENARIO: scenario, APP_JSON: JSON.stringify(app),
    SUBSCRIPTION_ID: '00000000-0000-0000-0000-000000000002',
    TENANT_ID: '00000000-0000-0000-0000-000000000001', FRONTEND_CLIENT_ID: client,
    SWA_HOSTNAME: 'fixture.azurestaticapps.net' };
  delete env.SWA_NAME;
  const calls = () => fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map(x => JSON.parse(x)) : [];
  return { root, checkout, env, app, calls };
}

test('frontend CLI deploy uses its parent directory, public lock restore and a nonlogged environment-only site token', t => {
  const f = fixture(t);
  const run = spawnSync('bash', ['-x', path.join(f.checkout, 'scripts/deploy-frontend.sh'), 'rg-fixture'],
    { env: f.env, encoding: 'utf8', timeout: 10000 });
  assert.equal(run.status, 0, run.stderr);
  assert(!((run.stdout + run.stderr).includes(token)));
  assert(!((run.stdout + run.stderr).includes(token.slice(-7))));
  const calls = f.calls();
  const deploy = calls.find(x => x.tool === 'swa');
  assert(deploy.hasToken);
  assert(!deploy.args.includes('--deployment-token'));
  assert(deploy.args.includes('--no-use-keychain'));
  assert.equal(deploy.cwd, path.join(f.checkout, 'materials/frontend'));
  assert.equal(deploy.args[1], './dist');
  assert(calls.some(x => x.tool === 'npm' && x.args[0] === 'ci' && x.args.includes('--include=dev') &&
    x.args.includes('--registry=https://registry.npmjs.org')));
  assert(calls.filter(x => x.tool === 'az').every(x => x.args.includes(f.env.SUBSCRIPTION_ID)));
});

test('failed upload, stale published HTML, unhealthy API and ambiguous SWA selection cannot report success', t => {
  for (const scenario of ['upload-failure', 'multiple-sites', 'unchanged-site', 'api-failure', 'unhealthy-api']) {
    const f = fixture(t, scenario);
    const run = spawnSync('bash', [path.join(f.checkout, 'scripts/deploy-frontend.sh'), 'rg-fixture'],
      { env: f.env, encoding: 'utf8', timeout: 10000 });
    assert.notEqual(run.status, 0);
    assert(!run.stdout.includes('Deployment Complete!'));
    assert(!(run.stdout + run.stderr).includes(token));
    if (scenario === 'multiple-sites') assert(!f.calls().some(x => x.tool === 'swa'));
  }
});

function spaProcedure() {
  const page = fs.readFileSync(path.join(repository, 'materials/docs/learner/day-1-deploy-infrastructure.ja.md'), 'utf8');
  const section = page.split('## 7. Static Web Apps URL を Entra ID に追加する')[1].split('## 8.')[0];
  return section.match(/```bash\n([\s\S]*?)```/)[1];
}

test('exact learner SPA command preserves existing URIs, uses the owned Client ID and does not duplicate the live callback', t => {
  for (const repeated of [false, true]) {
    const f = fixture(t);
    const origin = `https://${f.env.SWA_HOSTNAME}`;
    if (repeated) f.app.spa.redirectUris.push(origin);
    f.env.APP_JSON = JSON.stringify(f.app);
    const run = spawnSync('bash', ['-c', spaProcedure()], { env: f.env, encoding: 'utf8', timeout: 10000 });
    assert.equal(run.status, 0, run.stderr);
    const patch = f.calls().find(x => x.tool === 'az' && x.args[0] === 'rest');
    assert(patch.args.includes(`https://graph.microsoft.com/v1.0/applications/${object}`));
    const payload = JSON.parse(patch.args[patch.args.indexOf('--body') + 1]);
    assert.deepEqual(Object.keys(payload), ['spa']);
    assert.deepEqual(payload.spa.redirectUris.slice().sort(), [...new Set([...f.app.spa.redirectUris, origin])].sort());
  }
});

test('exact learner SPA command stops before writes on wrong tenant, app lookup failure, wrong Client ID or invalid existing URIs', t => {
  for (const scenario of ['wrong-tenant', 'app-read-failure', 'wrong-client', 'invalid-uris']) {
    const f = fixture(t, scenario);
    const run = spawnSync('bash', ['-c', spaProcedure()], { env: f.env, encoding: 'utf8', timeout: 10000 });
    assert.notEqual(run.status, 0);
    assert(!f.calls().some(x => x.tool === 'az' && x.args[0] === 'rest'));
  }
});
