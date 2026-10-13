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

test('real npm retains critical findings with audit-level none but still fails on audit service errors', { timeout: 30000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paas-audit-policy-'));
  t.after(() => fs.rmSync(root, { recursive: true }));
  let serviceFailure = false;
  const server = http.createServer((request, response) => {
    request.resume();
    response.setHeader('Content-Type', 'application/json');
    if (serviceFailure) {
      response.statusCode = 503;
      response.end(JSON.stringify({ error: 'Owned fixture service unavailable' }));
    } else if (request.url.includes('/security/advisories/bulk')) {
      response.end(JSON.stringify({ 'workshop-audit-fixture': [{
        id: 100001, name: 'workshop-audit-fixture', title: 'Owned critical fixture',
        url: 'https://example.invalid/owned-audit-fixture', severity: 'critical',
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
  }));
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({
    name: 'owned-audit-test', version: '1.0.0', lockfileVersion: 3, requires: true,
    packages: {
      '': { name: 'owned-audit-test', version: '1.0.0', dependencies: { 'workshop-audit-fixture': '1.0.0' } },
      'node_modules/workshop-audit-fixture': {
        version: '1.0.0', resolved: `${registry}/workshop-audit-fixture/-/fixture-1.0.0.tgz`,
      },
    },
  }));
  fs.writeFileSync(path.join(root, 'empty.npmrc'), '');
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([name]) => !/^npm_config_|^(NPM_TOKEN|NODE_AUTH_TOKEN)$/i.test(name)));
  Object.assign(env, { HOME: root, npm_config_userconfig: path.join(root, 'empty.npmrc'),
    npm_config_globalconfig: path.join(root, 'empty-global.npmrc'), npm_config_cache: path.join(root, 'cache') });
  async function audit(level) {
    return new Promise((resolve, reject) => {
      const child = spawn('npm', ['audit', '--package-lock-only', '--json', `--audit-level=${level}`,
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
  const informational = await audit('none');
  assert.equal(informational.code, 0, informational.stderr);
  assert.equal(JSON.parse(informational.stdout).metadata.vulnerabilities.critical, 1);
  serviceFailure = true;
  const failed = await audit('none');
  assert.notEqual(failed.code, 0);
  assert(JSON.parse(failed.stdout).error);
});
