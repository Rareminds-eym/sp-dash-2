import React, { Suspense } from 'react'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

export const metadata = {
  title: 'Rareminds Control - Super Admin Dashboard',
  description: 'Complete RBAC dashboard for managing universities, students, and skill passports',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange={true}
        >
          <Suspense fallback={<div className="p-6">Loading application...</div>}>
            {children}
          </Suspense>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}