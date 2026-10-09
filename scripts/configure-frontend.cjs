#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function configureFrontend(directory, values) {
  const config = {
    ENTRA_TENANT_ID: values.ENTRA_TENANT_ID,
    ENTRA_FRONTEND_CLIENT_ID: values.ENTRA_FRONTEND_CLIENT_ID,
    ENTRA_BACKEND_CLIENT_ID: values.ENTRA_BACKEND_CLIENT_ID,
    API_BASE_URL: '/api',
  };
  const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const [key, value] of Object.entries(config)) {
    if (key !== 'API_BASE_URL' && (typeof value !== 'string' || !guid.test(value))) {
      throw new Error(`Invalid public config: ${key}`);
    }
  }
  const indexPath = path.join(directory, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const pattern = /window\.__APP_CONFIG__\s*=\s*(?:null|undefined|\{[^<]*?\}|)\s*;/g;
  if ([...html.matchAll(pattern)].length !== 1) {
    throw new Error('Expected exactly one window.__APP_CONFIG__ placeholder.');
  }
  const assignment = `window.__APP_CONFIG__=${JSON.stringify(config)};`;
  fs.writeFileSync(indexPath, html.replace(pattern, assignment));
  if (!fs.readFileSync(indexPath, 'utf8').includes(assignment)) {
    throw new Error('Runtime config verification failed.');
  }
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/configure-frontend.cjs <dist-directory>');
    configureFrontend(process.argv[2], process.env);
    console.log('Frontend public runtime configuration prepared (API_BASE_URL=/api).');
  } catch (error) {
    console.error(`Frontend configuration failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { configureFrontend };
