import type { Metadata } from 'next'
import './globals.css'

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
    <html lang="en">
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
      <body>{children}</body>
    </html>
  )
}
