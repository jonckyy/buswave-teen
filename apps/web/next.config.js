/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@buswave/shared'],
  experimental: {
    // Required for workspace packages
    externalDir: true,
  },
}

module.exports = nextConfig
