import type { Metadata } from 'next'
import './globals.css'
import { ThemeToggle } from '@/components/theme-toggle'

export const metadata: Metadata = {
  title: 'Creative Compass',
  description: 'AI-powered creative strategy and idea generation platform',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // suppressHydrationWarning: the no-FOUC theme script adds `class="dark"` before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preload critical fonts */}
        <link
          rel="preload"
          href="/fonts/IBM_Plex_Sans_Thai/IBMPlexSansThai-Regular.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/IBM_Plex_Sans_Thai/IBMPlexSansThai-Medium.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/IBM_Plex_Sans_Thai/IBMPlexSansThai-SemiBold.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("cc-theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
        <ThemeToggle />
        {children}
      </body>
    </html>
  )
}
