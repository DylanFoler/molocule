/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@anthropic-ai/sdk'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'www.google.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
    ],
  },
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig
