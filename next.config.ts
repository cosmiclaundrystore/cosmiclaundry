import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Admin photo uploads (two tee photos per save, shrunk in the browser first). Vercel caps request bodies at 4.5 MB.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
