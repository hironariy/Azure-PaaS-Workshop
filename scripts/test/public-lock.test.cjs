const assert = require('node:assert/strict');
const { test } = require('node:test');
const { inspectPublicLock } = require('../check-public-lock.cjs');

const integrity = `sha512-${Buffer.alloc(64, 1).toString('base64')}`;
function fixture() {
  return { lockfileVersion: 3, packages: {
    '': { name: 'fixture' },
    'node_modules/@scope/parent': { version: '1.0.0',
      resolved: 'https://registry.npmjs.org/@scope/parent/-/parent-1.0.0.tgz', integrity },
  } };
}

test('public tarballs are verified; bundled children inherit a verified enclosing tarball only', () => {
  const lock = fixture();
  lock.packages['node_modules/@scope/parent/node_modules/child'] = { version: '1.0.0', inBundle: true };
  lock.packages['node_modules/@scope/parent/node_modules/child/node_modules/@scope/nested'] = {
    version: '1.0.0', inBundle: true,
  };
  const report = inspectPublicLock(lock);
  assert.equal(report.tarballs, 1);
  assert.equal(report.bundled, 2);
  assert.equal(report.installedApplicationValidated, false);
});

test('mirror/credential/local URLs, malformed integrity and missing unbundled provenance fail', () => {
  for (const override of [
    { resolved: 'https://mirror.example/parent.tgz' },
    { resolved: 'https://user:password@registry.npmjs.org/parent.tgz' },
    { resolved: 'file:parent.tgz' }, { resolved: undefined }, { integrity: 'sha512-invalid' },
    { integrity: undefined }, { link: true },
  ]) {
    const lock = fixture();
    Object.assign(lock.packages['node_modules/@scope/parent'], override);
    assert.throws(() => inspectPublicLock(lock), /Invalid|Unverified/);
  }
});

test('bundled claims cannot bypass missing parent, missing nested ancestor or path validation', () => {
  for (const name of ['node_modules/orphan', 'node_modules/@scope/parent/node_modules/missing/node_modules/child',
    'node_modules/@scope/parent/node_modules/../child']) {
    const lock = fixture();
    lock.packages[name] = { version: '1.0.0', inBundle: true };
    assert.throws(() => inspectPublicLock(lock), /Bundled|Invalid/);
  }
  assert.throws(() => inspectPublicLock({ packages: {} }), /lockfile/);
  assert.throws(() => inspectPublicLock({ lockfileVersion: 3, packages: [] }), /lockfile/);
});
