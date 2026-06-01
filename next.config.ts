import type { NextConfig } from "next";

const nextConfig: any = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Variable for emergency domain hardcode - TEMPORARY ALL-HANDS URL ONLY
  // TODO: Remove this after domain conflict is resolved
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://corpflow.sinfimac.pe',
  },

  // PROHIBIT old domain redirects in production
  // Block any redirect to sinfimac.pe from the server side
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://login.microsoftonline.com https://*.microsoftonline.com http://87.99.137.96:8000;",
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: 'https://login.microsoftonline.com https://*.microsoftonline.com',
          },
          // BLOCK redirects to old domain
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // FIX CACHE: Prevent service worker freeze
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
          },
        ],
      },
      // Root/index - force no cache for fresh sessions
      {
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      // Login page - force fresh load
      {
        source: '/login',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
          },
        ],
      },
      // Dashboard - no cache for auth required pages
      {
        source: '/dashboard/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
          },
        ],
      },
      // Explicitly block any redirect to sinfimac.pe
      {
        source: '/api/auth/callback/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://login.microsoftonline.com https://*.microsoftonline.com http://87.99.137.96:8000;",
          },
        ],
      },
    ];
  },
  // Configuración de imágenes para Azure AD
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.microsoftonline.com',
      },
      {
        protocol: 'http',
        hostname: '87.99.137.96',
        port: '8000',
      },
    ],
  },
};

export default nextConfig;
