'use client';

import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext<(msg: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** Shows one short message above the tab bar for a few seconds. */
export function ToastHost({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<{ text: string; key: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((text: string) => {
    setMessage({ text, key: Date.now() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2800);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && (
        <div key={message.key} className="toast pop" role="status" aria-live="polite">
          {message.text}
        </div>
      )}
    </ToastContext.Provider>
  );
}
