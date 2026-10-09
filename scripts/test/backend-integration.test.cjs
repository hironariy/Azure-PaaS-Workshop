const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const setup = path.resolve(__dirname, '../../materials/backend/test/integration/setup.cjs');

test('database integration requires an explicit numeric fixture port before any connection', () => {
  for (const port of ['', '0', '65536', '-1', '27017;echo private', 'mongodb://example.invalid']) {
    const result = spawnSync(process.execPath, ['--require', setup, '-e', 'process.exit(0)'], {
      env: { ...process.env, WORKSHOP_TEST_MONGO_PORT: port }, encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /WORKSHOP_TEST_MONGO_PORT must identify/);
  }
});

test('integration always selects loopback and a new fixture database, ignoring inherited cloud URIs', () => {
  const run = () => spawnSync(process.execPath, ['--require', setup, '-e',
    'console.log(JSON.stringify({uri:process.env.COSMOS_CONNECTION_STRING,env:process.env.NODE_ENV}))'], {
    env: {
      ...process.env, WORKSHOP_TEST_MONGO_PORT: '32768',
      COSMOS_CONNECTION_STRING: 'mongodb+srv://never-connect.example.invalid/existing',
    }, encoding: 'utf8',
  });
  const first = run();
  const second = run();
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  const value = JSON.parse(first.stdout);
  const url = new URL(value.uri);
  assert.equal(url.protocol, 'mongodb:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '32768');
  assert.match(url.pathname, /^\/workshop-integration-[a-f0-9-]{36}$/);
  assert.equal(url.username, '');
  assert.equal(value.env, 'test');
  assert.notEqual(value.uri, JSON.parse(second.stdout).uri);
});
