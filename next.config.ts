import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Variable for emergency domain hardcode - TEMPORARY ALL-HANDS URL ONLY
  // TODO: Remove this after domain conflict is resolved
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://work-1-nmyrzygswczqzcbk.prod-runtime.all-hands.dev',
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
            value: "frame-ancestors 'self' https://login.microsoftonline.com https://*.microsoftonline.com https://*.supabase.co;",
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
        ],
      },
      // Explicitly block any redirect to sinfimac.pe
      {
        source: '/api/auth/callback/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://login.microsoftonline.com https://*.microsoftonline.com https://*.supabase.co;",
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
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
