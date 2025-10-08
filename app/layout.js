import './globals.css'
import { ThemeProvider } from '@/components/providers/ThemeProvider'

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
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}