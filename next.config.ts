import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The dev-only corner badge sits over bottom sheets on phone screens.
  devIndicators: false,
  // PGlite ships WebAssembly and data files that must be loaded from node_modules, not bundled.
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
};

export default nextConfig;
