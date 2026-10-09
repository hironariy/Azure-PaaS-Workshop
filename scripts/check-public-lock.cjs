#!/usr/bin/env node

const fs = require('node:fs');

function inspectPublicLock(lock) {
  if (!lock || ![2, 3].includes(lock.lockfileVersion) || !lock.packages ||
      typeof lock.packages !== 'object' || Array.isArray(lock.packages) || !lock.packages['']) {
    throw new Error('Expected a version 2/3 npm lockfile with a root package');
  }
  const packages = Object.entries(lock.packages).filter(([name]) => name);
  const tarballs = new Set();
  const bundled = [];
  for (const [name, pkg] of packages) {
    if (!/^node_modules\/(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+(?:\/node_modules\/(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)*$/i.test(name) ||
        name.split('/').some((part) => part === '.' || part === '..') ||
        !pkg || typeof pkg !== 'object' || typeof pkg.version !== 'string' || pkg.link) {
      throw new Error(`Invalid public package entry: ${name}`);
    }
    if (!pkg.resolved && !pkg.integrity && pkg.inBundle === true) {
      bundled.push(name);
      continue;
    }
    const url = typeof pkg.resolved === 'string' ? URL.parse(pkg.resolved) : null;
    if (!url || url.origin !== 'https://registry.npmjs.org' || url.username || url.password ||
        !url.pathname.endsWith('.tgz') ||
        typeof pkg.integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(pkg.integrity)) {
      throw new Error(`Unverified public package source/integrity: ${name}`);
    }
    tarballs.add(name);
  }
  for (const name of bundled) {
    let ancestor = name;
    while (!tarballs.has(ancestor)) {
      const boundary = ancestor.lastIndexOf('/node_modules/');
      if (boundary < 0) throw new Error(`Bundled entry has no verified parent tarball: ${name}`);
      ancestor = ancestor.slice(0, boundary);
      if (!tarballs.has(ancestor) && !bundled.includes(ancestor)) {
        throw new Error(`Bundled entry has a missing/unverified parent: ${name}`);
      }
    }
  }
  return { status: 'public_sources_verified', packages: packages.length,
    tarballs: tarballs.size, bundled: bundled.length, installedApplicationValidated: false };
}

if (require.main === module) {
  try {
    if (!process.argv[2]) throw new Error('Supply the npm lockfile path');
    const source = fs.readFileSync(process.argv[2], 'utf8');
    let lock;
    try {
      lock = JSON.parse(source);
    } catch {
      throw new Error('Invalid lockfile JSON');
    }
    const report = inspectPublicLock(lock);
    console.log(JSON.stringify(report));
  } catch (error) {
    console.error(`Public lockfile verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { inspectPublicLock };
