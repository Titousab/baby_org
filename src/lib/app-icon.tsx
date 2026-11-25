import { ImageResponse } from 'next/og';

const SAGE_SOFT = '#E3EDDE';
const SAGE_INK = '#3D5E39';

/** The app icon: the sign-in sun mark on a sage square. iOS rounds the corners itself, so `rounded` is off for it. */
export function renderAppIcon(size: number, rounded = true): ImageResponse {
  const mark = Math.round(size * 0.62);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: SAGE_SOFT,
          borderRadius: rounded ? size * 0.22 : 0,
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 48 48" fill="none" stroke={SAGE_INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 31a14 14 0 0 1 28 0" />
          <path d="M6 31h36" />
          <path d="M24 9v4M11 15l3 3M37 15l-3 3" />
          <path d="M15 38h18" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
