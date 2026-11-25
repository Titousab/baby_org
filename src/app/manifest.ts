import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ezra',
    short_name: 'Ezra',
    description: "Ezra's day, classes and caretakers, for his family.",
    start_url: '/',
    display: 'standalone',
    background_color: '#FBF6EE',
    theme_color: '#FBF6EE',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
