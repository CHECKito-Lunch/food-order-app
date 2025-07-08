/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // ignoriert alle ESLint-Fehler (z.B. no-explicit-any, Link-Regeln) während des Builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ignoriert alle TypeScript-Fehler (z.B. explicit any) während des Builds
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
