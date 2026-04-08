'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FaHeartbeat, FaChevronLeft, FaChevronRight, FaSignOutAlt } from 'react-icons/fa'
import { User } from '@/lib/auth-context'

interface MenuItem {
  path: string
  icon: string
  label: string
  roles: string[]
}

const menuItems: MenuItem[] = [
  { path: '/dashboard', icon: 'dashboard', label: 'Dashboard', roles: ['admin', 'medico', 'recepcion', 'laboratorio'] },
  { path: '/dashboard/registro', icon: 'person_add', label: 'Registro', roles: ['admin', 'recepcion'] },
  { path: '/dashboard/consulta', icon: 'search', label: 'Consulta', roles: ['admin', 'recepcion', 'laboratorio'] },
  { path: '/dashboard/facturas', icon: 'receipt_long', label: 'Facturas', roles: ['admin', 'recepcion'] },
  { path: '/dashboard/resultados', icon: 'science', label: 'Resultados', roles: ['admin', 'medico', 'laboratorio'] },
  { path: '/dashboard/imagenologia', icon: 'settings_overscan', label: 'Imagenes', roles: ['admin', 'medico', 'laboratorio'] },
]

interface SidebarProps {
  user: User
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  onLogout: () => void
}

export default function Sidebar({ user, isOpen, setIsOpen, onLogout }: SidebarProps) {
  const pathname = usePathname()
  
  const filteredMenu = menuItems.filter(item => item.roles.includes(user.role))

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`fixed top-0 left-0 h-full z-50 bg-white dark:bg-[#10131b] border-r border-slate-200 dark:border-white/5 transition-all duration-300 flex flex-col
        ${isOpen ? 'w-64' : 'w-20'}
        ${!isOpen && 'max-lg:-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-slate-200 dark:border-white/5 ${isOpen ? 'px-5 justify-between' : 'justify-center'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <FaHeartbeat className="text-white text-lg" />
            </div>
            {isOpen && (
              <div className="overflow-hidden">
                <p className="font-bold text-slate-800 dark:text-white text-sm">Centro Diagnostico</p>
                <p className="text-xs text-cyan-600 dark:text-[#3df5e7] font-semibold">MI ESPERANZA</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="hidden lg:flex w-8 h-8 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            {isOpen ? <FaChevronLeft /> : <FaChevronRight />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {filteredMenu.map((item) => {
            const isActive = pathname === item.path || (item.path !== '/dashboard' && pathname?.startsWith(item.path))
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                  ${isActive 
                    ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-[#3df5e7]' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white'}
                `}
              >
                <span className={`material-symbols-outlined text-[22px] ${isActive ? 'text-cyan-600 dark:text-[#3df5e7]' : ''}`}>
                  {item.icon}
                </span>
                {isOpen && (
                  <span className="font-medium text-sm">{item.label}</span>
                )}
                {!isOpen && (
                  <div className="absolute left-20 px-2 py-1 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className={`border-t border-slate-200 dark:border-white/5 p-3 ${isOpen ? '' : 'flex flex-col items-center'}`}>
          {isOpen ? (
            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-white/5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-teal-400 flex items-center justify-center text-white font-bold text-sm">
                {user.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-800 dark:text-white truncate">{user.nombre}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user.role}</p>
              </div>
              <button
                onClick={onLogout}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-red-500 transition-colors"
                title="Cerrar sesion"
              >
                <FaSignOutAlt />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogout}
              className="w-10 h-10 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center"
              title="Cerrar sesion"
            >
              <FaSignOutAlt />
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
