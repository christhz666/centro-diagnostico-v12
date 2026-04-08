'use client'

import { useState } from 'react'
import { FaBars, FaSun, FaMoon, FaBell, FaUser } from 'react-icons/fa'
import { User } from '@/lib/auth-context'

interface HeaderProps {
  user: User
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  title: string
}

export default function Header({ user, sidebarOpen, setSidebarOpen, title }: HeaderProps) {
  const [darkMode, setDarkMode] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <header className={`fixed top-0 right-0 h-16 bg-white/80 dark:bg-[#10131b]/80 backdrop-blur-xl z-30 flex items-center justify-between px-4 lg:px-6 border-b border-slate-200 dark:border-white/5 transition-all duration-300
      ${sidebarOpen ? 'left-64' : 'left-20 max-lg:left-0'}
    `}>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400"
        >
          <FaBars />
        </button>
        <h1 className="text-lg font-semibold text-slate-800 dark:text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <button 
          onClick={toggleDarkMode}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors"
        >
          {darkMode ? <FaSun className="text-amber-400" /> : <FaMoon />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors relative"
          >
            <FaBell />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 bg-white dark:bg-[#1c2029] rounded-xl border border-slate-200 dark:border-white/10 shadow-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/20">
                <h3 className="font-semibold text-slate-800 dark:text-white">Notificaciones</h3>
              </div>
              <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                <FaBell className="text-3xl mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay notificaciones nuevas</p>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-white/10">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-800 dark:text-white">{user.nombre}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user.role}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-teal-400 flex items-center justify-center text-white font-bold text-sm">
            {user.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
        </div>
      </div>
    </header>
  )
}
