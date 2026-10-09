const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { homedir } = require('node:os');

const BASE = ['WORKSHOP_REPO_DIR', 'WORKSHOP_STATE_DIR', 'LOCATION', 'SWA_LOCATION', 'BASE_NAME',
  'GROUP_ID', 'RESOURCE_GROUP', 'PARAM_FILE', 'SUBSCRIPTION_ID', 'TENANT_ID'];
const IDENTITY = ['BACKEND_CLIENT_ID', 'FRONTEND_CLIENT_ID', 'ACCESS_SCOPE_ID'];
const DEPLOYED = ['APP_SERVICE_NAME', 'SWA_NAME', 'SWA_HOSTNAME'];
const KEYS = [...BASE, ...IDENTITY, ...DEPLOYED];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function canonicalPath(value) {
  let current = path.resolve(value);
  const missing = [];
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) throw new Error('Cannot resolve state path');
    missing.unshift(path.basename(current));
    current = parent;
  }
  return path.join(fs.realpathSync(current), ...missing);
}

function validate(values, directory, stage = 'base') {
  if (!['base', 'identity', 'deployed'].includes(stage)) throw new Error('Unknown state stage');
  for (const key of KEYS) {
    if (values[key] !== undefined &&
        (typeof values[key] !== 'string' || /[\u0000-\u001f\u007f]/.test(values[key]))) {
      throw new Error(`Invalid state value: ${key}`);
    }
  }
  for (const key of [...BASE, ...(stage !== 'base' ? IDENTITY : []), ...(stage === 'deployed' ? DEPLOYED : [])]) {
    if (key !== 'GROUP_ID' && !values[key]) throw new Error(`Missing state value: ${key}`);
  }
  if (values.GROUP_ID === undefined || !/^[A-Za-z0-9-]{0,10}$/.test(values.GROUP_ID)) {
    throw new Error('Invalid GROUP_ID');
  }
  for (const key of ['SUBSCRIPTION_ID', 'TENANT_ID', ...IDENTITY]) {
    if (values[key] && !UUID.test(values[key])) throw new Error(`Invalid UUID: ${key}`);
  }
  if (values.BACKEND_CLIENT_ID && values.FRONTEND_CLIENT_ID &&
      values.BACKEND_CLIENT_ID.toLowerCase() === values.FRONTEND_CLIENT_ID.toLowerCase()) {
    throw new Error('Backend and frontend must use distinct application IDs');
  }
  for (const key of ['LOCATION', 'SWA_LOCATION']) {
    if (!/^[a-z0-9]{2,40}$/.test(values[key])) throw new Error(`Invalid region: ${key}`);
  }
  if (!/^[a-z][a-z0-9-]{1,19}$/.test(values.BASE_NAME)) throw new Error('Invalid BASE_NAME');
  if (!/^[A-Za-z0-9_().-]{1,90}$/.test(values.RESOURCE_GROUP) || values.RESOURCE_GROUP.endsWith('.')) {
    throw new Error('Invalid RESOURCE_GROUP');
  }
  for (const key of ['WORKSHOP_REPO_DIR', 'WORKSHOP_STATE_DIR', 'PARAM_FILE']) {
    if (!path.isAbsolute(values[key])) throw new Error(`Absolute path required: ${key}`);
  }
  if (path.resolve(values.WORKSHOP_STATE_DIR) !== path.resolve(directory) ||
      path.dirname(path.resolve(values.PARAM_FILE)) !== path.resolve(directory)) {
    throw new Error('State/parameter directory mismatch');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.bicepparam$/.test(path.basename(values.PARAM_FILE))) {
    throw new Error('PARAM_FILE must name a .bicepparam file in the dedicated state directory');
  }
  const statePath = canonicalPath(directory);
  const repositoryPath = canonicalPath(values.WORKSHOP_REPO_DIR);
  const insideRepository = path.relative(repositoryPath, statePath);
  if (statePath === path.parse(statePath).root || statePath === canonicalPath(homedir()) ||
      (!insideRepository.startsWith(`..${path.sep}`) && insideRepository !== '..' && !path.isAbsolute(insideRepository))) {
    throw new Error('Use a dedicated state directory outside the repository, not root or home');
  }
  for (const file of ['README.md', 'materials/bicep/main.bicep', 'scripts/workshop-state.sh']) {
    if (!fs.existsSync(path.join(values.WORKSHOP_REPO_DIR, file))) {
      throw new Error('Saved repository path is missing; restore the checkout before loading state');
    }
  }
  if (fs.realpathSync(values.WORKSHOP_REPO_DIR) !== fs.realpathSync(path.join(__dirname, '..'))) {
    throw new Error('Saved repository does not match the helper checkout');
  }
  for (const key of ['APP_SERVICE_NAME', 'SWA_NAME']) {
    if (values[key] && !/^[A-Za-z0-9-]{1,60}$/.test(values[key])) throw new Error(`Invalid resource name: ${key}`);
  }
  if (values.SWA_HOSTNAME && (!values.SWA_HOSTNAME.endsWith('.azurestaticapps.net') ||
      values.SWA_HOSTNAME.length > 253 ||
      !values.SWA_HOSTNAME.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)))) {
    throw new Error('Invalid SWA_HOSTNAME');
  }
  return values;
}

function readState(directory, stage = 'base') {
  const file = path.join(directory, 'paas-workshop.json');
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('State must be a regular JSON file');
  if (stat.size > 65536) throw new Error('Workshop state exceeds the expected metadata size');
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!state || state.version !== 1 || !state.values || typeof state.values !== 'object' ||
      Object.keys(state).some((key) => !['version', 'values'].includes(key)) ||
      Array.isArray(state.values) || Object.keys(state.values).some((key) => !KEYS.includes(key))) {
    throw new Error('Unsupported or malformed workshop state; do not source legacy .env files');
  }
  return validate(state.values, directory, stage);
}

function writeState(directory, values, initialize = false) {
  validate(values, directory);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'paas-workshop.json');
  const lock = path.join(directory, '.paas-workshop.lock');
  const descriptor = fs.openSync(lock, 'wx', 0o600);
  const temporary = path.join(directory, `.paas-workshop-${randomUUID()}.tmp`);
  try {
    if (initialize) {
      if (fs.existsSync(file)) throw new Error('State already initialized; load it instead of overwriting');
      if (fs.existsSync(path.join(directory, 'paas-workshop.env'))) {
        throw new Error('Legacy .env state exists; review it manually and use a separate JSON state directory');
      }
    } else {
      const previous = readState(directory);
      for (const key of ['SUBSCRIPTION_ID', 'TENANT_ID', 'RESOURCE_GROUP', 'BASE_NAME', 'GROUP_ID']) {
        if (previous[key] !== values[key]) throw new Error(`Target changed: ${key}; use a separate state directory`);
      }
    }
    fs.writeFileSync(temporary, `${JSON.stringify({ version: 1, values }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.closeSync(descriptor);
    fs.unlinkSync(lock);
  }
}

function main(action, directory, stage) {
  if (!directory || !path.isAbsolute(directory)) throw new Error('Absolute WORKSHOP_STATE_DIR required');
  if (action === 'load') {
    const values = readState(directory, stage);
    for (const key of KEYS) process.stdout.write(`${key}\0${values[key] ?? ''}\0`);
    process.stdout.write(`ENV_FILE\0${path.join(directory, 'paas-workshop.json')}\0`);
  } else if (action === 'init' || action === 'save') {
    const keys = action === 'init' ? BASE : KEYS;
    const values = Object.fromEntries(keys.filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]));
    validate(values, directory, stage);
    writeState(directory, values, action === 'init');
  } else {
    throw new Error('Usage: workshop-state.cjs <init|save|load> <state-directory> [base|identity|deployed]');
  }
}

if (require.main === module) {
  try {
    main(...process.argv.slice(2));
  } catch (error) {
    console.error(`Workshop state error: ${error instanceof Error ? error.message : 'Unknown failure'}`);
    process.exitCode = 1;
  }
}

module.exports = { validate, readState, writeState };
