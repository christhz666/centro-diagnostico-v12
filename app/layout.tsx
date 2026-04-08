import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Centro Diagnostico MI ESPERANZA',
  description: 'Sistema de Gestion de Laboratorio Clinico',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background-light dark:bg-background-dark text-slate-800 dark:text-gray-100 antialiased">
        {children}
      </body>
    </html>
  )
}
