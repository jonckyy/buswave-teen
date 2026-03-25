/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@buswave/shared'],
  experimental: {
    // Required for workspace packages
    externalDir: true,
  },
  webpack: (config) => {
    // Allow .js imports to resolve to .ts files in workspace packages
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    }
    return config
  },
}

module.exports = nextConfig
