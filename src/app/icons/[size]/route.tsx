import { renderAppIcon } from '@/lib/app-icon';

const SIZES = new Set([192, 512]);

/** Home-screen icons listed in the web app manifest: /icons/192 and /icons/512. */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response('Not found', { status: 404 });
  return renderAppIcon(size);
}
