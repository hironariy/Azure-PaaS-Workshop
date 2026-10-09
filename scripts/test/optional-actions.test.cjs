const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { configureFrontend } = require('../configure-frontend.cjs');

const repository = path.resolve(__dirname, '../..');
const ids = {
  ENTRA_TENANT_ID: '00000000-0000-0000-0000-000000000001',
  ENTRA_FRONTEND_CLIENT_ID: '00000000-0000-0000-0000-000000000002',
  ENTRA_BACKEND_CLIENT_ID: '00000000-0000-0000-0000-000000000003',
};

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'paas-actions-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  return directory;
}

function template(name) {
  return fs.readFileSync(path.join(repository, '.github/workflow-templates', name), 'utf8');
}

function runBlock(name, step) {
  const text = template(name);
  const escaped = step.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const section = text.match(new RegExp(`      - name: ${escaped}\\n([\\s\\S]*?)(?=\\n      - name:|\\n  [a-z-]+:|$)`));
  assert(section, `Missing template step: ${step}`);
  const block = section[1].match(/        run: \|\n([\s\S]*)/);
  assert(block, `Missing run block: ${step}`);
  return block[1].split('\n').map((line) => line.replace(/^          /, '')).join('\n');
}

function execute(script, env) {
  return spawnSync('bash', ['-e', '-o', 'pipefail', '-c', script], {
    env: { ...process.env, ...env }, encoding: 'utf8', timeout: 10000,
  });
}

test('shared frontend artifact configuration is strict, repeatable and preserves surrounding HTML', (t) => {
  const directory = temporaryDirectory(t);
  const file = path.join(directory, 'index.html');
  fs.writeFileSync(file, '<h1>Workshop</h1><script>window.__APP_CONFIG__ = null;</script>');
  configureFrontend(directory, ids);
  const first = fs.readFileSync(file, 'utf8');
  assert(first.startsWith('<h1>Workshop</h1>'));
  assert(first.includes(`"ENTRA_FRONTEND_CLIENT_ID":"${ids.ENTRA_FRONTEND_CLIENT_ID}"`));
  assert(first.includes('"API_BASE_URL":"/api"'));
  configureFrontend(directory, ids);
  assert.equal(fs.readFileSync(file, 'utf8'), first);
});

test('invalid public IDs and absent or ambiguous placeholders fail before changing the artifact', (t) => {
  const directory = temporaryDirectory(t);
  const file = path.join(directory, 'index.html');
  const initial = '<script>window.__APP_CONFIG__=null;</script>';
  fs.writeFileSync(file, initial);
  for (const invalid of ['', null, 42, 'PRIVATE_CONFIG_FIXTURE']) {
    assert.throws(() => configureFrontend(directory, { ...ids, ENTRA_TENANT_ID: invalid }),
      (error) => error.message === 'Invalid public config: ENTRA_TENANT_ID');
    assert.equal(fs.readFileSync(file, 'utf8'), initial);
  }
  for (const html of ['<h1>No placeholder</h1>', initial + initial]) {
    fs.writeFileSync(file, html);
    assert.throws(() => configureFrontend(directory, ids), /exactly one/);
    assert.equal(fs.readFileSync(file, 'utf8'), html);
  }
});

test('frontend production branch and token checks fail explicitly without printing the token', () => {
  const script = runBlock('deploy-frontend.yml', 'Require the production branch and deployment token');
  for (const [ref, token, success] of [
    ['refs/heads/main', 'PRIVATE_TOKEN_FIXTURE', true],
    ['refs/heads/main', '', false],
    ['refs/heads/feature', 'PRIVATE_TOKEN_FIXTURE', false],
  ]) {
    const result = execute(script, { GITHUB_REF: ref, SWA_DEPLOYMENT_TOKEN: token });
    assert.equal(result.status === 0, success, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_TOKEN_FIXTURE/);
  }
});

test('backend production configuration checks reject missing IDs and shell-shaped values', () => {
  const script = runBlock('deploy-backend.yml', 'Validate production branch, OIDC IDs and deployment target');
  const env = {
    GITHUB_REF: 'refs/heads/main', AZURE_CLIENT_ID: ids.ENTRA_BACKEND_CLIENT_ID,
    AZURE_TENANT_ID: ids.ENTRA_TENANT_ID, AZURE_SUBSCRIPTION_ID: ids.ENTRA_FRONTEND_CLIENT_ID,
    AZURE_RESOURCE_GROUP: 'rg-fixture', AZURE_WEBAPP_NAME: 'app-fixture',
  };
  assert.equal(execute(script, env).status, 0);
  for (const change of [
    { GITHUB_REF: 'refs/heads/feature' }, { AZURE_CLIENT_ID: '' },
    { AZURE_TENANT_ID: 'PRIVATE_CONFIG_FIXTURE' }, { AZURE_RESOURCE_GROUP: '$(exit 0)' },
    { AZURE_WEBAPP_NAME: 'app-fixture; exit 0' },
  ]) {
    const result = execute(script, { ...env, ...change });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_CONFIG_FIXTURE/);
  }
});

test('optional deployment templates preserve public artifacts, scoped targets and least privilege', () => {
  const frontend = template('deploy-frontend.yml');
  const backend = template('deploy-backend.yml');
  for (const text of [frontend, backend]) {
    for (const match of text.matchAll(/uses: ([^\n #]+)/g)) assert.match(match[1], /@[0-9a-f]{40}$/);
    assert.match(text, /persist-credentials: false/);
    assert.match(text, /--include=dev.*--registry=https:\/\/registry\.npmjs\.org/);
    assert.doesNotMatch(text, /continue-on-error|AZURE_CREDENTIALS|run:.*\$\{\{ vars\./);
  }
  assert.match(frontend, /Azure\/static-web-apps-deploy@[0-9a-f]{40}/);
  assert.match(frontend, /output_location: ''/);
  assert.match(frontend, /api_location: ''/);
  assert.match(frontend, /SKIP_DEPLOY_ON_MISSING_SECRETS: 'false'/);
  assert.match(frontend, /node scripts\/configure-frontend.cjs materials\/frontend\/dist/);
  assert.doesNotMatch(frontend, /swa deploy|static-web-apps-cli|repo_token:|id-token:/);
  const build = backend.split('\n  deploy:')[0];
  const deploy = backend.split('\n  deploy:')[1];
  assert.doesNotMatch(build, /id-token: write|Azure\/login@/);
  assert.match(deploy, /needs: build/);
  assert.match(deploy, /id-token: write/);
  assert.doesNotMatch(deploy, /npm ci|npm run|npm test/);
  assert.match(deploy, /--startup-file "node dist\/src\/app.js"/);
  assert.match(deploy, /--query defaultHostName/);
  assert.match(deploy, /workshop_wait_for_health "https:\/\/\$APP_HOSTNAME\/health"/);
});

test('optional OIDC setup configures public Variables and stops on a GitHub failure', (t) => {
  for (const failure of [false, true]) {
    const directory = temporaryDirectory(t);
    const bin = path.join(directory, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env node
const fs=require('node:fs');
fs.appendFileSync(process.env.MOCK_LOG,JSON.stringify(process.argv.slice(2))+'\\n');
if(process.env.MOCK_FAIL==='true'){console.error('Variable update rejected fixture');process.exit(9);}
`, { mode: 0o755 });
    const log = path.join(directory, 'calls.jsonl');
    const result = execute('source "$SETUP"; GH_AVAILABLE=true; GITHUB_USER=fixture; REPO_NAME=fixture; APP_ID="$FIXTURE_APP"; TENANT_ID="$FIXTURE_TENANT"; SUBSCRIPTION_ID="$FIXTURE_SUB"; configure_github_secrets', {
      PATH: `${bin}:${process.env.PATH}`, SETUP: path.join(repository, 'scripts/workshop-setup.sh'),
      FIXTURE_APP: ids.ENTRA_BACKEND_CLIENT_ID, FIXTURE_TENANT: ids.ENTRA_TENANT_ID,
      FIXTURE_SUB: ids.ENTRA_FRONTEND_CLIENT_ID, GITHUB_USER: 'fixture', REPO_NAME: 'fixture',
      MOCK_LOG: log, MOCK_FAIL: String(failure),
    });
    assert.equal(result.status === 0, !failure, result.stderr);
    const calls = fs.readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(calls.length, failure ? 1 : 3);
    assert(calls.every((args) => args[0] === 'variable' && args[1] === 'set'));
    assert.equal(calls[0][2], 'AZURE_CLIENT_ID');
    assert(calls.every((args) => args[args.indexOf('--repo') + 1] === 'fixture/fixture'));
  }
});
