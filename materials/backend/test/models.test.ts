import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { Post, generateSlug } from '../src/models/Post';
import { sanitizeHtml, sanitizePlain, sanitizeTagValue } from '../src/utils/sanitize';
import { sanitizeConnectionString, sanitizeForLog } from '../src/utils/logger';

test('ASCII slug generation preserves the current title convention', () => {
  assert.equal(generateSlug(' Hello, Azure World! '), 'hello-azure-world');
});

test('Unicode titles have normalized nonempty URL-safe slugs', () => {
  for (const [title, expected] of [
    ['日本語の記事', '日本語の記事'],
    ['中文文章', '中文文章'],
    ['한국어 제목', '한국어-제목'],
    ['Café résumé', 'café-résumé'],
    ['Cafe\u0301', 'café'],
    ['Azure 日本語の記事', 'azure-日本語の記事'],
    ['-- 日本語 --', '日本語'],
  ]) {
    assert.equal(generateSlug(title), expected);
  }
  for (const title of ['😀', '!!!', '---', ' ']) {
    assert.match(generateSlug(title), /^post-[a-f0-9-]{36}$/);
  }
  const slug = generateSlug('𠮷'.repeat(101));
  assert.equal(Array.from(slug).length, 100);
  assert.equal(decodeURIComponent(encodeURIComponent(slug)), slug);
});

test('a draft preserves Japanese content without a database connection', () => {
  const post = new Post({
    title: 'Azure 入門',
    slug: 'azure-introduction',
    content: '日本語の本文',
    excerpt: '日本語の要約',
    tags: ['日本語'],
    author: new Types.ObjectId(),
  });
  assert.equal(post.validateSync(), undefined);
  assert.equal(post.status, 'draft');
  assert.equal(post.content, '日本語の本文');
  assert.deepEqual(post.tags, ['日本語']);
});

test('the post schema rejects an empty slug', () => {
  const post = new Post({
    title: 'Example',
    slug: '',
    content: 'Content',
    author: new Types.ObjectId(),
  });
  assert.equal(post.validateSync()?.errors.slug.kind, 'required');
});

test('sanitization retains teachable formatting and removes executable content', () => {
  const clean = sanitizeHtml('<p>日本語 <strong>Azure</strong></p><script>alert(1)</script>');
  assert.equal(clean, '<p>日本語 <strong>Azure</strong></p>');
  assert.equal(sanitizePlain('<b>日本語</b>'), '日本語');
  assert.equal(sanitizeTagValue('<b> Azure </b>'), 'azure');
  assert.equal(sanitizeHtml('<a href="javascript:alert(1)">link</a>'), '<a>link</a>');
  assert.equal(sanitizeHtml('<img src=x onerror=alert(1)>'), '');
});

test('diagnostic helpers redact credentials and sensitive fields', () => {
  assert.equal(
    sanitizeConnectionString('mongodb+srv://fixture-user:fixture-password@example.invalid/db'),
    'mongodb+srv://***:***@example.invalid/db',
  );
  assert.deepEqual(
    sanitizeForLog({ password: 'fixture-password', token: 'fixture-token', status: 'healthy' }),
    { password: '***REDACTED***', token: '***REDACTED***', status: 'healthy' },
  );
});
