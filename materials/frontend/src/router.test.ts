import { createMemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';

it('resolves existing article URLs and decodes encoded path segments once', async () => {
  const router = createMemoryRouter([{ path: '/posts/:slug', id: 'post' }], {
    initialEntries: ['/posts/existing-ascii-url'],
  });
  try {
    expect(router.state.matches[0]?.params.slug).toBe('existing-ascii-url');
    const slug = '日本語/%旧記事';
    await router.navigate(`/posts/${encodeURIComponent(slug)}`);
    expect(router.state.matches[0]?.params.slug).toBe(slug);
  } finally {
    router.dispose();
  }
});
