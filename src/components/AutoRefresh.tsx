'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const EVERY_MS = 60_000;

/** Picks up what others logged: on return to the app, and every minute while it is on screen. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    const timer = setInterval(refreshIfVisible, EVERY_MS);
    return () => {
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      clearInterval(timer);
    };
  }, [router]);
  return null;
}
