import type { Metadata, Viewport } from 'next';
import { Figtree, Fredoka } from 'next/font/google';
import './globals.css';

const fredoka = Fredoka({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-fredoka' });
const figtree = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-figtree' });

export const metadata: Metadata = {
  title: 'Ezra',
  description: "Ezra's day, classes and caretakers, for his family.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBF6EE' },
    { media: '(prefers-color-scheme: dark)', color: '#1C1916' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fredoka.variable} ${figtree.variable}`}>
      <body>
        <div className="stage">
          <div className="app" id="app">{children}</div>
        </div>
      </body>
    </html>
  );
}
