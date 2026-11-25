'use client';

import { type ReactNode, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: IconName;
  /** One of the color token names: sage, peach, sky, lav, butter. */
  color?: string;
  children: ReactNode;
};

/** A bottom sheet over the app column, as in the mockup. Closes on Esc and on a tap outside. */
export function Sheet({ open, onClose, title, icon, color = 'sage', children }: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Sheets only open after a tap, so this always runs in the browser.
  const host = open ? document.getElementById('app') : null;
  if (!host) return null;
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <section className="sheet gut in" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="grabber" aria-hidden="true" />
        <div className="sheet-head">
          {icon && (
            <span className="sheet-ico" style={tint(color)}>
              <Icon name={icon} />
            </span>
          )}
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </section>
    </>,
    host,
  );
}

/** CSS variables that color a component from one token family (mockup's `tint`). */
export function tint(color: string): React.CSSProperties {
  return {
    ['--c' as string]: `var(--${color})`,
    ['--cs' as string]: `var(--${color}-soft)`,
    ['--ci' as string]: `var(--${color}-ink)`,
  };
}
