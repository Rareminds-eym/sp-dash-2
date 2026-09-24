const path = require('path');

const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  typescript: {
    // Ignore external node_modules type check errors during build
    ignoreBuildErrors: true,
  },
  // Configured for Cloudflare Pages deployment with Edge Runtime
  images: {
    unoptimized: false,
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  serverExternalPackages: ['jose', 'bcryptjs'],
  experimental: {
    // Enable service bindings for Cloudflare Workers
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:8789', '*.pages.dev', '*.rareminds.in'],
    },
  },
  webpack(config, { dev, isServer, nextRuntime }) {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        fs: false,
        path: false,
        stream: false,
        buffer: false,
      };
    }
    if (nextRuntime === 'edge') {
      config.resolve.alias = {
        ...config.resolve.alias,
        'async_hooks': 'node:async_hooks',
      };
    }
    if (dev) {
      // Reduce CPU/memory from file watching
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "default-src 'self'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
