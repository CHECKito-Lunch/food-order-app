/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Ignoriere ESLint-Fehler während des Builds
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
