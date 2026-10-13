import { afterEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  get: vi.fn(async () => ({ data: { slug: '日本語の記事' } })),
  put: vi.fn(async () => ({ data: { slug: '日本語の記事' } })),
  delete: vi.fn(async () => undefined),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
}));

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return { default: { ...actual.default, create: () => client } };
});
vi.mock('../config/msalInstance', () => ({
  getMsalInitPromise: () => Promise.resolve(),
  getMsalInstance: vi.fn(),
}));
vi.mock('../config/authConfig', () => ({ createApiRequest: vi.fn() }));

describe('article URL path encoding', () => {
  afterEach(() => vi.clearAllMocks());

  it('encodes Unicode and reserved characters once in read/update/delete paths', async () => {
    const { getPost, updatePost, deletePost } = await import('./api');
    const slug = '日本語/%旧記事';
    const path = `/api/posts/${encodeURIComponent(slug)}`;
    await getPost(slug);
    await updatePost(slug, { title: 'Updated' });
    await deletePost(slug);
    expect(client.get).toHaveBeenCalledWith(path, { authMode: 'optional' });
    expect(client.put).toHaveBeenCalledWith(path, { title: 'Updated' }, { authMode: 'required' });
    expect(client.delete).toHaveBeenCalledWith(path, { authMode: 'required' });
  });

  it('classifies failures without exposing internal response messages', async () => {
    const { getCreatePostErrorMessage } = await import('./api');
    for (const status of [400, 401, 403, 409, 429, 500]) {
      const message = getCreatePostErrorMessage({
        isAxiosError: true, response: { status, data: { message: 'private fixture detail' } },
      });
      expect(message).not.toContain('private fixture detail');
      expect(message.length).toBeGreaterThan(10);
    }
    expect(getCreatePostErrorMessage({ isAxiosError: true, response: { status: 409 } }))
      .toContain('article URL');
    expect(getCreatePostErrorMessage(new Error('private fixture detail')))
      .toContain('input is preserved');
  });
});
