import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Creative Strategist',
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
      <body>{children}</body>
    </html>
  )
}
