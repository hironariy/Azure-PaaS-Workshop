import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { User } from '../src/models';
import { logger } from '../src/utils/logger';

test('unknown-author lists preserve the complete pagination response without a database', async (t) => {
  logger.silent = true;
  t.mock.method(User, 'findOne', async () => null);
  const { createApp } = await import('../src/app');
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.ok(address !== null && typeof address === 'object');
  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/posts?author=missing&page=2&limit=7`,
    { signal: AbortSignal.timeout(5000) },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    posts: [], total: 0, page: 2, limit: 7, totalPages: 0,
  });
});
