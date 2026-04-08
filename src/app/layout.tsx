import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SINFIMAC Ecosystem",
  description: "Advanced FM & Productivity Platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Corpflow",
  },
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
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
