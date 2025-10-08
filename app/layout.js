import './globals.css'

export const metadata = {
  title: 'Rareminds Control - Super Admin Dashboard',
  description: 'Complete RBAC dashboard for managing universities, students, and skill passports',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}