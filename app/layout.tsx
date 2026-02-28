import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-ibm-plex-sans-arabic",
  subsets: ["arabic", "latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "TeleStream",
  description: "Unified Telegram channel timeline reader",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TeleStream",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#060a13" },
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
  ],
};

// Inline script to prevent theme flash on load
const themeScript = `(function(){try{var t=localStorage.getItem('telestream-theme');var d=document.documentElement;if(t==='light'){d.setAttribute('data-theme','light')}else if(t==='dark'){d.setAttribute('data-theme','dark')}else{d.setAttribute('data-theme',window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')}}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' wss://*.telegram.org wss://pluto.web.telegram.org wss://venus.web.telegram.org wss://aurora.web.telegram.org wss://vesta.web.telegram.org wss://flora.web.telegram.org https://*.telegram.org; img-src 'self' data: blob:;" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body
        className={`${ibmPlexSansArabic.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
