import { expect, test } from '@playwright/test';

test('the app can be installed: manifest, icons and the iPhone icon link', async ({ request }) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.status()).toBe(200);
  const m = await manifest.json();
  expect(m).toMatchObject({
    name: 'Ezra',
    short_name: 'Ezra',
    display: 'standalone',
    start_url: '/',
    background_color: '#FBF6EE',
    theme_color: '#FBF6EE',
  });
  const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of m.icons) expect(icon.purpose).toBe('any');

  for (const size of ['192', '512']) {
    const res = await request.get(`/icons/${size}`, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  }

  const signin = await request.get('/signin');
  const html = await signin.text();
  expect(html).toContain('rel="apple-touch-icon"');
  expect(html).toContain('name="apple-mobile-web-app-title" content="Ezra"');
});
