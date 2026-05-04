import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headers de seguridad para permitir redirecciones desde Microsoft
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
