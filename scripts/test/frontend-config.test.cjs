const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { configureFrontend } = require('../configure-frontend.cjs');

const values = {
  ENTRA_TENANT_ID: '00000000-0000-0000-0000-000000000001',
  ENTRA_FRONTEND_CLIENT_ID: '00000000-0000-0000-0000-000000000002',
  ENTRA_BACKEND_CLIENT_ID: '00000000-0000-0000-0000-000000000003',
};

function fixture(t, html) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'paas-runtime-config-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  fs.writeFileSync(path.join(directory, 'index.html'), html);
  return directory;
}

test('runtime writer supports build placeholders and replaces one previous assignment', (t) => {
  for (const placeholder of ['null', 'undefined', '', '{"API_BASE_URL":"https://old.invalid"}']) {
    const directory = fixture(t, `<script>window.__APP_CONFIG__ = ${placeholder};</script>`);
    configureFrontend(directory, values);
    const expected = `window.__APP_CONFIG__=${JSON.stringify({ ...values, API_BASE_URL: '/api' })};`;
    assert.equal(fs.readFileSync(path.join(directory, 'index.html'), 'utf8'),
      `<script>${expected}</script>`);
    configureFrontend(directory, values);
    assert.equal(fs.readFileSync(path.join(directory, 'index.html'), 'utf8'),
      `<script>${expected}</script>`);
  }
});

test('invalid IDs and missing or duplicate placeholders fail without changing the artifact', (t) => {
  const cases = [
    { html: '<script>window.__APP_CONFIG__=null;</script>',
      input: { ...values, ENTRA_TENANT_ID: 'PRIVATE_VALUE_FIXTURE' } },
    { html: '<html>missing placeholder</html>', input: values },
    { html: '<script>window.__APP_CONFIG__=null;window.__APP_CONFIG__=null;</script>', input: values },
  ];
  for (const { html, input } of cases) {
    const directory = fixture(t, html);
    assert.throws(() => configureFrontend(directory, input), (error) =>
      !error.message.includes('PRIVATE_VALUE_FIXTURE'));
    assert.equal(fs.readFileSync(path.join(directory, 'index.html'), 'utf8'), html);
  }
});
