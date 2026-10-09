import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { config } from '../src/config/environment';
import { errorHandler } from '../src/middleware/error.middleware';
import { logger } from '../src/utils/logger';

test('API identity requires a signed resource token and delegated user permission', async (t) => {
  logger.silent = true;
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'fixture-signing-key';
  const publicJwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' };
  t.mock.method(jwksClient.JwksClient.prototype, 'getKeys', async () => [publicJwk]);
  const { authenticate, optionalAuthenticate } = await import('../src/middleware/auth.middleware');
  const app = express();
  app.get('/required', authenticate, (req, res) => res.json({ user: req.user }));
  app.get('/optional', optionalAuthenticate, (req, res) => res.json({ authenticated: !!req.user }));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.ok(address !== null && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const claims: JwtPayload = {
    oid: '00000000-0000-0000-0000-000000000011',
    sub: 'fixture-subject',
    name: 'Fixture user',
    upn: 'fixture@example.invalid',
    scp: 'access_as_user',
    ver: '1.0',
  };
  const v1Issuer = `https://sts.windows.net/${config.entraTenantId}/`;
  const v2Issuer = `https://login.microsoftonline.com/${config.entraTenantId}/v2.0`;
  const sign = (values: JwtPayload = claims, options: SignOptions = {}): string =>
    jwt.sign(values, privateKey, {
      algorithm: 'RS256', keyid: kid, audience: `api://${config.entraClientId}`,
      issuer: v1Issuer, expiresIn: '5m', ...options,
    });
  const request = (authorization?: string, route: string = '/required'): Promise<Response> =>
    fetch(origin + route, {
      headers: authorization ? { Authorization: authorization } : {},
      signal: AbortSignal.timeout(5000),
    });
  const rejectToken = async (token: string, status: number = 401): Promise<void> => {
    const response = await request(`Bearer ${token}`);
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.error.code, status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED');
  };

  await t.test('v1 API URI and GUID audiences preserve verified user claim mapping', async () => {
    for (const audience of [`api://${config.entraClientId}`, config.entraClientId]) {
      const response = await request(`Bearer ${sign(claims, { audience })}`);
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).user, {
        oid: claims.oid, sub: claims.sub, name: claims.name,
        email: 'fixture@example.invalid', preferredUsername: 'fixture@example.invalid',
      });
    }
  });

  await t.test('v2 API GUID audiences work with the scope requested by the SPA', async () => {
    const response = await request(`Bearer ${sign({
      ...claims, ver: '2.0', upn: undefined, preferred_username: 'fixture@example.invalid',
      scp: 'another_scope access_as_user',
    }, { audience: config.entraClientId, issuer: v2Issuer })}`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.oid, claims.oid);
  });

  await t.test('wrong signature, tenant, resource, expiry, algorithm and signing key fail', async () => {
    const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    for (const token of [
      sign(claims, { audience: '00000000-0000-0000-0000-000000000099' }),
      sign(claims, { issuer: 'https://sts.windows.net/00000000-0000-0000-0000-000000000099/' }),
      sign(claims, { issuer: v2Issuer }),
      sign({ ...claims, ver: '2.0' }, { audience: config.entraClientId, issuer: v1Issuer }),
      sign({ ...claims, ver: '2.0' }, { issuer: v2Issuer }),
      sign({ ...claims, ver: undefined }),
      sign({ ...claims, ver: '3.0' }),
      sign(claims, { expiresIn: -1 }),
      sign(claims, { notBefore: '5m' }),
      sign(claims, { keyid: 'missing-fixture-key' }),
      jwt.sign(claims, otherKey, {
        algorithm: 'RS256', keyid: kid, audience: `api://${config.entraClientId}`, issuer: v1Issuer,
      }),
      jwt.sign(claims, 'fixture-hmac-secret', {
        algorithm: 'HS256', keyid: kid, audience: `api://${config.entraClientId}`, issuer: v1Issuer,
      }),
      jwt.sign(claims, privateKey, {
        algorithm: 'RS256', audience: `api://${config.entraClientId}`, issuer: v1Issuer,
      }),
    ]) {
      await rejectToken(token);
    }
  });

  await t.test('ID tokens, app-only roles, wrong scopes and absent user identity cannot authorize writes', async () => {
    for (const values of [
      { ...claims, scp: undefined },
      { ...claims, scp: undefined, roles: ['access_as_user'] },
      { ...claims, scp: ['access_as_user'] },
      { ...claims, oid: undefined },
      { ...claims, oid: 123 },
      { ...claims, sub: undefined },
      { ...claims, sub: '' },
    ]) {
      await rejectToken(sign(values));
    }
    await rejectToken(sign({ ...claims, scp: 'other_scope' }), 403);
    await rejectToken(sign({ ...claims, scp: undefined, ver: '2.0' }, {
      audience: config.entraClientId, issuer: v2Issuer,
    }));
  });

  await t.test('required bearer errors and optional anonymous fallback remain explicit', async () => {
    for (const authorization of [undefined, 'Basic fixture', 'Bearer ', 'Bearer not-a-jwt']) {
      assert.equal((await request(authorization)).status, 401);
    }
    for (const authorization of [undefined, `Bearer ${sign({ ...claims, scp: 'other_scope' })}`]) {
      const response = await request(authorization, '/optional');
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { authenticated: false });
    }
    assert.deepEqual(await (await request(`Bearer ${sign()}`, '/optional')).json(), {
      authenticated: true,
    });
  });
});
