import assert from 'node:assert/strict';
import { test } from 'node:test';
import express, { Request, Response as ExpressResponse, NextFunction } from 'express';
import { once } from 'node:events';
import { AddressInfo } from 'node:net';
import { Query, Types } from 'mongoose';
import * as auth from '../src/middleware/auth.middleware';
import { Post, User } from '../src/models';
import { errorHandler } from '../src/middleware/error.middleware';
import { logger } from '../src/utils/logger';

test('post creation accepts Unicode and handles slug-only races through the real HTTP route', async (t) => {
  logger.silent = true;
  const user = new User({
    oid: 'fixture-oid',
    email: 'fixture@example.invalid',
    displayName: 'Fixture',
    username: 'fixture',
  });
  t.mock.method(auth, 'authenticate', async (req: Request, _res: ExpressResponse, next: NextFunction) => {
    req.user = {
      oid: 'fixture-oid', sub: 'fixture-sub', name: 'Fixture',
      email: 'fixture@example.invalid', preferredUsername: 'fixture',
    };
    next();
  });
  t.mock.method(User, 'findOne', async () => user);
  const existing = new Set<string>();
  let race = false;
  let unrelatedConflict = false;
  let exhaust = false;
  const saved = new Map<string, unknown>();
  t.mock.method(Post, 'exists', async (filter: { slug: string }) => {
    return exhaust || existing.has(filter.slug) ? { _id: new Types.ObjectId() } : null;
  });
  t.mock.method(Post, 'create', async (data: Record<string, unknown>) => {
    if (unrelatedConflict) throw { code: 11000, keyPattern: { author: 1 } };
    if (race) {
      race = false;
      throw { code: 11000, keyPattern: { slug: 1 } };
    }
    const doc = new Post(data);
    await doc.validate();
    existing.add(doc.slug);
    saved.set(String(doc._id), doc.toObject());
    return doc;
  });
  t.mock.method(Query.prototype, 'exec', async function (this: Query<unknown, unknown>) {
    return saved.get(String(this.getFilter()._id));
  });
  const posts = (await import('../src/routes/posts.routes')).default;
  const app = express();
  app.use(express.json());
  app.use('/api/posts', posts);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const create = (title: string, status: string = 'draft'): Promise<Response> => fetch(
    `${origin}/api/posts`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content: '<p>日本語の本文</p>', status }) },
  );

  for (const title of ['日本語の記事', '中文文章', '한국어', '😀', '!!!', 'Café']) {
    for (const status of ['draft', 'published']) {
      const response = await create(title, status);
      assert.equal(response.status, 201);
      const doc = await response.json();
      assert.ok(doc.slug && doc.slug !== '-');
      assert.equal(doc.title, title);
      assert.equal(doc.content, '<p>日本語の本文</p>');
      assert.equal(doc.status, status);
    }
  }
  const duplicate = await create('日本語の記事');
  assert.equal(duplicate.status, 201);
  assert.equal((await duplicate.json()).slug, '日本語の記事-by-fixture-2');

  race = true;
  const raced = await create('競合');
  assert.equal(raced.status, 201);
  assert.equal((await raced.json()).slug, '競合-by-fixture');

  unrelatedConflict = true;
  assert.equal((await create('Other conflict')).status, 500);
  unrelatedConflict = false;
  exhaust = true;
  assert.equal((await create('Exhausted')).status, 409);
  exhaust = false;
  assert.equal((await create('<script>alert(1)</script>')).status, 400);
});
