
import type { NextConfig } from 'next';
import withNextIntl from 'next-intl/plugin';

const config: NextConfig = {
  // distDir: 'build', // Commented out for Vercel compatibility
  // NEXT 15 FIX: serverComponentsExternalPackages moved out of experimental
  serverExternalPackages: ['@genkit-ai/google-genai', 'date-fns-tz', 'firebase-admin', 'js-cookie'],

  // NEXT 15 FIX: serverActions is now on by default. 
  // Custom body size limits are now handled like this:
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
  },

  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '**',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

const withNextIntlConfig = withNextIntl('./src/i18n.ts'); 

export default withNextIntlConfig(config);
