import type { Metadata, Viewport } from "next";
import { Hind_Madurai, Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

// Inter for Latin letters and numbers, Hind Madurai for Tamil (browser picks per character).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const tamil = Hind_Madurai({ subsets: ["tamil"], weight: ["400", "500", "600", "700"], variable: "--font-tamil", display: "swap" });

export const metadata: Metadata = {
  title: "ஸ்ரீ செந்தூரர் கேட்டரிங்",
  description: "Sri Chendurar Catering Manager",
  manifest: "/manifest.json",
  applicationName: "செந்தூரர்",
  appleWebApp: { capable: true, title: "செந்தூரர்", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1b1a" },
  ],
};

// Applies dark mode before first paint (no flash).
const themeScript = `try{if(localStorage.getItem('scc_theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ta" className={`${inter.variable} ${tamil.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
