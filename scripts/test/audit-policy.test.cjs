const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { test } = require('node:test');

test('active workflow audits report findings without disabling other failures', () => {
  const workflow = fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/quality.yml'), 'utf8');
  const audits = workflow.match(/npm audit[^\n]+/g);
  assert(audits?.length >= 4);
  for (const command of audits) {
    assert(command.includes('--audit-level=none'), command);
    assert(!command.includes('|| true'), command);
  }
  assert(!workflow.includes('continue-on-error: true'));
  for (const command of ['npm run type-check', 'npm run lint', 'npm test', 'npm run build',
    'scripts/check-public-lock.cjs', 'npm run test:integration']) {
    assert(workflow.includes(command), command);
  }
});

test('quarterly audits cover both applications and scopes with an independent vulnerability gate', () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, '../../.github/workflows/blog-app-dependencies.yml'), 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /cron: "24 3 1 1,4,7,10 \*"/);
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.match(workflow, /fail-fast: false/);
  assert.match(workflow, /application: \[backend, frontend\]/);
  assert.match(workflow, /name: all\s+flag: --include=dev/);
  assert.match(workflow, /name: production\s+flag: --omit=dev/);
  assert.match(workflow, /working-directory: materials\/\$\{\{ matrix\.application \}\}/);
  assert.match(workflow, /AUDIT_FLAG: \$\{\{ matrix\.audit\.flag \}\}/);
  assert(workflow.includes('node ../../scripts/check-public-lock.cjs package-lock.json'));
  assert(workflow.includes(
    'npm audit --package-lock-only "$AUDIT_FLAG" --audit-level=low --registry=https://registry.npmjs.org'));
  assert(!workflow.includes('continue-on-error:'));
  assert(!workflow.includes('|| true'));
  assert(!workflow.includes('npm ci'));
  for (const action of workflow.matchAll(/uses: ([^\s]+)/g)) {
    assert.match(action[1], /@[a-f0-9]{40}$/);
  }
  assert.match(workflow, /persist-credentials: false/);
});

test('real npm enforces quarterly scopes, preserves informational findings and rejects service errors', { timeout: 30000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paas-audit-policy-'));
  t.after(() => fs.rmSync(root, { recursive: true }));
  let serviceFailure = false;
  let clean = false;
  let lowOnly = false;
  const server = http.createServer((request, response) => {
    request.resume();
    response.setHeader('Content-Type', 'application/json');
    if (serviceFailure) {
      response.statusCode = 503;
      response.end(JSON.stringify({ error: 'Owned fixture service unavailable' }));
    } else if (request.url.includes('/security/advisories/bulk')) {
      response.end(JSON.stringify(clean ? {} : { 'workshop-audit-fixture': lowOnly ? [] : [{
        id: 100001, name: 'workshop-audit-fixture', title: 'Owned critical fixture',
        url: 'https://example.invalid/owned-audit-fixture', severity: 'critical',
        vulnerable_versions: '<1.0.1',
      }], 'workshop-audit-dev-fixture': [{
        id: 100002, name: 'workshop-audit-dev-fixture', title: 'Owned low development fixture',
        url: 'https://example.invalid/owned-audit-dev-fixture', severity: 'low',
        vulnerable_versions: '<1.0.1',
      }] }));
    } else if (request.url.startsWith('/workshop-audit-fixture')) {
      response.end(JSON.stringify({
        name: 'workshop-audit-fixture', 'dist-tags': { latest: '1.0.1' },
        versions: {
          '1.0.0': { name: 'workshop-audit-fixture', version: '1.0.0' },
          '1.0.1': { name: 'workshop-audit-fixture', version: '1.0.1' },
        },
      }));
    } else if (request.url.startsWith('/workshop-audit-dev-fixture')) {
      response.end(JSON.stringify({
        name: 'workshop-audit-dev-fixture', 'dist-tags': { latest: '1.0.1' },
        versions: {
          '1.0.0': { name: 'workshop-audit-dev-fixture', version: '1.0.0' },
          '1.0.1': { name: 'workshop-audit-dev-fixture', version: '1.0.1' },
        },
      }));
    } else {
      response.statusCode = 404;
      response.end(JSON.stringify({ error: 'Unexpected owned fixture request' }));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const registry = `http://127.0.0.1:${server.address().port}`;
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: 'owned-audit-test', version: '1.0.0', dependencies: { 'workshop-audit-fixture': '1.0.0' },
    devDependencies: { 'workshop-audit-dev-fixture': '1.0.0' },
  }));
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({
    name: 'owned-audit-test', version: '1.0.0', lockfileVersion: 3, requires: true,
    packages: {
      '': { name: 'owned-audit-test', version: '1.0.0', dependencies: { 'workshop-audit-fixture': '1.0.0' },
        devDependencies: { 'workshop-audit-dev-fixture': '1.0.0' } },
      'node_modules/workshop-audit-fixture': {
        version: '1.0.0', resolved: `${registry}/workshop-audit-fixture/-/fixture-1.0.0.tgz`,
      },
      'node_modules/workshop-audit-dev-fixture': {
        version: '1.0.0', dev: true,
        resolved: `${registry}/workshop-audit-dev-fixture/-/fixture-1.0.0.tgz`,
      },
    },
  }));
  fs.writeFileSync(path.join(root, 'empty.npmrc'), '');
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([name]) => !/^npm_config_|^(NPM_TOKEN|NODE_AUTH_TOKEN)$/i.test(name)));
  Object.assign(env, { HOME: root, npm_config_userconfig: path.join(root, 'empty.npmrc'),
    npm_config_globalconfig: path.join(root, 'empty-global.npmrc'), npm_config_cache: path.join(root, 'cache') });
  async function audit(level, scope = '--include=dev') {
    return new Promise((resolve, reject) => {
      const child = spawn('npm', ['audit', '--package-lock-only', scope, '--json', `--audit-level=${level}`,
        `--registry=${registry}`, '--fetch-retries=0', '--fetch-timeout=3000'], { cwd: root, env });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', value => { stdout += value; });
      child.stderr.on('data', value => { stderr += value; });
      child.on('error', reject);
      child.on('close', code => resolve({ code, stdout, stderr }));
    });
  }
  const gated = await audit('low');
  assert.equal(gated.code, 1, gated.stderr);
  assert.equal(JSON.parse(gated.stdout).metadata.vulnerabilities.critical, 1);
  assert.equal(JSON.parse(gated.stdout).metadata.vulnerabilities.low, 1);
  const production = await audit('low', '--omit=dev');
  assert.equal(production.code, 1, production.stderr);
  assert.equal(JSON.parse(production.stdout).metadata.vulnerabilities.critical, 1);
  assert.equal(JSON.parse(production.stdout).metadata.vulnerabilities.low, 0);
  const informational = await audit('none');
  assert.equal(informational.code, 0, informational.stderr);
  assert.equal(JSON.parse(informational.stdout).metadata.vulnerabilities.critical, 1);
  lowOnly = true;
  const lowSeverity = await audit('low');
  assert.equal(lowSeverity.code, 1, lowSeverity.stderr);
  assert.equal(JSON.parse(lowSeverity.stdout).metadata.vulnerabilities.low, 1);
  assert.equal(JSON.parse(lowSeverity.stdout).metadata.vulnerabilities.critical, 0);
  const cleanProduction = await audit('low', '--omit=dev');
  assert.equal(cleanProduction.code, 0, cleanProduction.stderr);
  assert.equal(JSON.parse(cleanProduction.stdout).metadata.vulnerabilities.total, 0);
  clean = true;
  const cleanAudit = await audit('low');
  assert.equal(cleanAudit.code, 0, cleanAudit.stderr);
  assert.equal(JSON.parse(cleanAudit.stdout).metadata.vulnerabilities.total, 0);
  serviceFailure = true;
  for (const level of ['none', 'low']) {
    const failed = await audit(level);
    assert.notEqual(failed.code, 0);
    assert(JSON.parse(failed.stdout).error);
  }
});
