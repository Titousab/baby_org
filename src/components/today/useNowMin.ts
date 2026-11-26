'use client';

import { useEffect, useState } from 'react';
import { minutesNowNY } from '@/lib/time';

const EVERY_MS = 30_000;

/**
 * Minutes since midnight in New York, kept current: every 30 seconds, and as soon as the app comes back on screen.
 * Starts at `initial` (the server's value) so the server and the browser render alike.
 */
export function useNowMin(initial: number): number {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const update = () => setNow(minutesNowNY());
    const updateIfVisible = () => {
      if (document.visibilityState === 'visible') update();
    };
    const timer = setInterval(update, EVERY_MS);
    document.addEventListener('visibilitychange', updateIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', updateIfVisible);
    };
  }, []);
  return now;
}
