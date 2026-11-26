'use client';

import { useEffect, useState } from 'react';
import { minutesNowNY } from '@/lib/time';

const EVERY_MS = 30_000;

/** Minutes since midnight in New York, kept current. Starts at the server's value so both render alike. */
export function useNowMin(initial: number): number {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const timer = setInterval(() => setNow(minutesNowNY()), EVERY_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}
