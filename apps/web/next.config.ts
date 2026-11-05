import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@iseeyou/shared-types'],
};

export default nextConfig;
