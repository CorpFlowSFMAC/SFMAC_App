import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SINFIMAC Ecosystem",
  description: "Advanced FM & Productivity Platform",
  themeColor: "#020C1F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${outfit.variable}`}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if('serviceWorker' in navigator){
                navigator.serviceWorker.getRegistrations().then(function(regs){
                  regs.forEach(function(r){r.unregister()});
                });
                caches.keys().then(function(names){
                  names.forEach(function(n){caches.delete(n)});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
