import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { Server } from 'node:http';
import { Request, Response as ExpressResponse, NextFunction } from 'express';
import * as auth from '../../src/middleware/auth.middleware';
import { Post, User } from '../../src/models';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';
import { ApiError } from '../../src/middleware/error.middleware';
import { logger } from '../../src/utils/logger';

const actors: Record<string, auth.AuthenticatedUser> = Object.fromEntries(
  ['alice', 'bob', 'charlie'].map((name, index) => [name, {
    oid: `00000000-0000-0000-0000-${String(index + 11).padStart(12, '0')}`,
    sub: `fixture-${name}`,
    name: `${name} fixture`,
    email: `${name}@example.invalid`,
    preferredUsername: name,
  }]),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readObject(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json();
  assert.ok(isRecord(body));
  return body;
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  assert.ok(typeof value === 'string', `${key} must be a string`);
  return value;
}

test('isolated MongoDB persists the full application HTTP contracts', { timeout: 60_000 }, async (t) => {
  logger.silent = true;
  const attachActor = (req: Request): boolean => {
    const actor = Object.entries(actors).find(([name]) =>
      req.headers.authorization === `Bearer fixture-${name}`)?.[1];
    if (!actor) return false;
    req.user = actor;
    return true;
  };
  t.mock.method(auth, 'authenticate', async (
    req: Request, _res: ExpressResponse, next: NextFunction,
  ): Promise<void> => {
    if (!attachActor(req)) return next(ApiError.unauthorized('Fixture identity required'));
    next();
  });
  t.mock.method(auth, 'optionalAuthenticate', async (
    req: Request, _res: ExpressResponse, next: NextFunction,
  ): Promise<void> => {
    attachActor(req);
    next();
  });

  let server: Server | undefined;
  t.after(async () => {
    try {
      if (server) {
        const currentServer = server;
        await new Promise<void>((resolve, reject) => {
          currentServer.close((error) => error ? reject(error) : resolve());
        });
      }
    } finally {
      await disconnectDatabase();
    }
  });
  await connectDatabase();
  await Promise.all([User.init(), Post.init()]);
  for (const name of ['alice', 'bob']) {
    const actor = actors[name];
    await User.create({
      oid: actor.oid, email: actor.email, displayName: actor.name, username: name,
    });
  }
  t.beforeEach(async () => {
    await Post.deleteMany({});
  });
  const { createApp } = await import('../../src/app');
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address !== null && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const request = async (
    method: string, route: string, status: number, actor?: string, body?: Record<string, unknown>,
  ): Promise<Response> => {
    const response = await fetch(origin + route, {
      method,
      headers: {
        ...(actor ? { Authorization: `Bearer fixture-${actor}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, status, `${method} ${route}: ${await response.clone().text()}`);
    return response;
  };
  const create = async (
    title: string, status: string = 'draft', actor: string = 'alice',
  ): Promise<Record<string, unknown>> => readObject(await request('POST', '/api/posts', 201, actor, {
    title, content: '<p>日本語の本文</p><script>alert(1)</script>', status, tags: ['日本語'],
  }));
  const routeFor = (post: Record<string, unknown>): string =>
    `/api/posts/${encodeURIComponent(stringField(post, 'slug'))}`;

  await t.test('connected health, missing identity and empty pagination have exact contracts', async () => {
    for (const route of ['/health', '/api/health']) {
      assert.equal((await readObject(await request('GET', route, 200))).status, 'healthy');
    }
    await request('POST', '/api/posts', 401, undefined, { title: 'No identity', content: 'No identity' });
    await request('GET', '/api/posts/my', 401);
    for (const route of ['/api/posts', '/api/posts?author=missing', '/api/posts/my']) {
      assert.deepEqual(await readObject(await request('GET', route, 200, 'alice')), {
        posts: [], total: 0, page: 1, limit: 10, totalPages: 0,
      });
    }
  });

  await t.test('Unicode drafts persist and are visible only to their author', async () => {
    const post = await create('日本語の記事');
    assert.equal(post.slug, '日本語の記事');
    assert.equal(post.content, '<p>日本語の本文</p>');
    assert.equal(post.status, 'draft');
    const persisted = await Post.findById(post._id);
    assert.equal(persisted?.content, '<p>日本語の本文</p>');
    await request('GET', routeFor(post), 404);
    await request('GET', routeFor(post), 404, 'bob');
    assert.equal((await readObject(await request('GET', routeFor(post), 200, 'alice')))._id, post._id);
    assert.equal((await readObject(await request('GET', '/api/posts', 200))).total, 0);
    const mine = await readObject(await request('GET', '/api/posts/my?status=draft', 200, 'alice'));
    assert.equal(mine.total, 1);
    assert.ok(Array.isArray(mine.posts));
    assert.equal(mine.posts.length, 1);
    assert.equal((await readObject(await request('GET', '/api/posts/my', 200, 'bob'))).total, 0);
  });

  await t.test('the real unique index arbitrates concurrent Unicode title collisions', async () => {
    const posts = await Promise.all([create('同じ記事', 'published'), create('同じ記事', 'published')]);
    assert.equal(new Set(posts.map((post) => stringField(post, 'slug'))).size, 2);
    assert.equal(await Post.countDocuments({ title: '同じ記事' }), 2);
    const author = await User.findOne({ oid: actors.alice.oid });
    assert.ok(author);
    await assert.rejects(Post.create({
      title: 'Index fixture', slug: posts[0].slug, content: 'Duplicate fixture', author: author._id,
    }), (error: unknown) =>
      isRecord(error) && error.code === 11000 && isRecord(error.keyPattern) && error.keyPattern.slug === 1);
    const first = await readObject(await request('GET', '/api/posts?limit=1', 200));
    const second = await readObject(await request('GET', '/api/posts?limit=1&page=2', 200));
    for (const page of [first, second]) {
      assert.equal(page.total, 2);
      assert.equal(page.limit, 1);
      assert.equal(page.totalPages, 2);
      assert.ok(Array.isArray(page.posts));
      assert.equal(page.posts.length, 1);
    }
    assert.equal(first.page, 1);
    assert.equal(second.page, 2);
    assert.notDeepEqual(first.posts, second.posts);
  });

  await t.test('ownership and sanitized-empty edits reject writes without changing persisted content', async () => {
    const post = await create('編集前の記事');
    await request('PUT', routeFor(post), 403, 'bob', { title: 'Another author' });
    await request('DELETE', routeFor(post), 403, 'bob');
    await request('PUT', routeFor(post), 401, undefined, { title: 'No identity' });
    await request('DELETE', routeFor(post), 401);
    await request('PUT', routeFor(post), 400, 'alice', { title: '<script>alert(1)</script>' });
    assert.equal((await Post.findById(post._id))?.title, '編集前の記事');
  });

  await t.test('editing a historical ASCII permalink never regenerates its URL', async () => {
    const author = await User.findOne({ oid: actors.alice.oid });
    assert.ok(author);
    const legacy = await Post.create({
      title: 'Legacy title', slug: 'existing-ascii-link', content: '<p>Legacy</p>',
      author: author._id, status: 'published',
    });
    const route = '/api/posts/existing-ascii-link';
    const updated = await readObject(await request('PUT', route, 200, 'alice', {
      title: '更新した日本語タイトル', content: '<p>更新</p><script>alert(1)</script>',
    }));
    assert.equal(updated.slug, 'existing-ascii-link');
    assert.equal(updated.title, '更新した日本語タイトル');
    assert.equal(updated.content, '<p>更新</p>');
    assert.equal((await readObject(await request('GET', route, 200)))._id, String(legacy._id));
  });

  await t.test('published content survives database reconnection and owned deletion is persistent', async () => {
    const post = await create('再接続して読む記事');
    await request('PUT', routeFor(post), 200, 'alice', { status: 'published' });
    await disconnectDatabase();
    for (const route of ['/health', '/api/health']) {
      assert.equal((await readObject(await request('GET', route, 503))).status, 'unhealthy');
    }
    await connectDatabase();
    for (const route of ['/health', '/api/health']) {
      assert.equal((await readObject(await request('GET', route, 200))).status, 'healthy');
    }
    const restored = await readObject(await request('GET', routeFor(post), 200));
    assert.equal(restored.status, 'published');
    assert.equal(restored.content, '<p>日本語の本文</p>');
    assert.ok(typeof restored.publishedAt === 'string');
    await request('DELETE', routeFor(post), 403, 'bob');
    await request('DELETE', routeFor(post), 204, 'alice');
    await request('GET', routeFor(post), 404);
    assert.equal(await Post.findById(post._id), null);
  });

  await t.test('first-time identity creates a persisted profile and an emoji title gets a stable URL', async () => {
    assert.equal(await User.findOne({ oid: actors.charlie.oid }), null);
    const post = await create('😀', 'draft', 'charlie');
    assert.match(stringField(post, 'slug'), /^post-[a-f0-9-]{36}$/);
    assert.equal((await User.findOne({ oid: actors.charlie.oid }))?.username, 'charlie');
    assert.equal((await readObject(await request('GET', routeFor(post), 200, 'charlie')))._id, post._id);
  });
});
