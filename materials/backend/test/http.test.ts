import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { AddressInfo } from 'node:net';
import { once } from 'node:events';
import * as database from '../src/config/database';
import healthRoutes from '../src/routes/health.routes';
import { ApiError, errorHandler, notFoundHandler } from '../src/middleware/error.middleware';
import { logger } from '../src/utils/logger';

test('health and API error HTTP contracts do not require Azure or database credentials', async (t) => {
  logger.silent = true;
  const connected = t.mock.method(database, 'isDatabaseConnected', () => true);
  const app = express();
  app.use(healthRoutes);
  app.get('/fixture-conflict', (_req, _res, next) => next(ApiError.conflict('Fixture conflict')));
  app.get('/fixture-error', (_req, _res, next) => next(new Error('Internal fixture details')));
  app.use(notFoundHandler);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const healthy = await fetch(`${origin}/health`);
  assert.equal(healthy.status, 200);
  assert.equal((await healthy.json()).status, 'healthy');

  connected.mock.mockImplementation(() => false);
  const unhealthy = await fetch(`${origin}/health`);
  assert.equal(unhealthy.status, 503);
  assert.equal((await unhealthy.json()).reason, 'Database not connected');
  assert.equal((await fetch(`${origin}/ready`)).status, 503);
  assert.equal((await fetch(`${origin}/live`)).status, 200);

  const conflict = await fetch(`${origin}/fixture-conflict`);
  assert.equal(conflict.status, 409);
  assert.deepEqual(await conflict.json(), {
    error: { code: 'CONFLICT', message: 'Fixture conflict' },
  });

  const internal = await fetch(`${origin}/fixture-error`);
  assert.equal(internal.status, 500);
  assert.deepEqual(await internal.json(), {
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
  assert.equal((await fetch(`${origin}/missing`)).status, 404);
});
