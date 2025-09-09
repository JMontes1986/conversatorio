
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
       {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mbosvnmhnbrslfwlfcxu.supabase.co",
        port: "",
        pathname: "/**",
      }
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
      // Extend the timeout for server actions to 2 minutes for lengthy operations like video uploads.
      executionTimeout: 120,
    }
  }
};

export default nextConfig;
