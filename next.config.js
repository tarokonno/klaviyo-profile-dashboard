/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
    ];
  },
  // Increase server limits for large API keys
  experimental: {
    serverComponentsExternalPackages: [],
  },
  // Configure server options
  serverRuntimeConfig: {
    maxHeaderSize: 32768, // 32KB header limit
  },
};

module.exports = nextConfig; 