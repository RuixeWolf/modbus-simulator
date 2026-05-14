import type { Metadata } from 'next'
import { Geist, Geist_Mono, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: 'Modbus Device Simulator',
  description: 'Modbus TCP/RTU device simulator with real-time dashboard'
}

const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('theme-preference') || 'system';
      var resolved = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;
      if (resolved === 'dark') {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {}
  })();
`

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} h-full w-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full w-full flex-col items-stretch bg-zinc-50 transition-colors duration-300 dark:bg-[#08080c]">
        {children}
      </body>
    </html>
  )
}
