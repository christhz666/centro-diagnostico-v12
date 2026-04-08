'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth, AuthProvider } from '@/lib/auth-context'
import Sidebar from '@/components/sidebar'
import Header from '@/components/header'
import { FaHeartbeat } from 'react-icons/fa'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/registro': 'Registro de Pacientes',
  '/dashboard/consulta': 'Consulta Rapida',
  '/dashboard/facturas': 'Facturas',
  '/dashboard/resultados': 'Resultados de Laboratorio',
  '/dashboard/imagenologia': 'Imagenologia',
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background-dark">
        <div className="relative">
          <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 animate-ping" />
          <FaHeartbeat className="text-6xl text-cyan-500 relative animate-pulse" />
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  const currentTitle = pageTitles[pathname || '/dashboard'] || 'Dashboard'

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-background-dark">
      <Sidebar 
        user={user} 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen}
        onLogout={handleLogout}
      />
      <Header 
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        title={currentTitle}
      />
      <main className={`pt-16 min-h-screen transition-all duration-300 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}`}>
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </AuthProvider>
  )
}
