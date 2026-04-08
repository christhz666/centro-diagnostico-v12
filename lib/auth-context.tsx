'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface User {
  id: string
  nombre: string
  email: string
  role: 'admin' | 'medico' | 'recepcion' | 'laboratorio'
  avatar?: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Usuarios de prueba
const MOCK_USERS: Record<string, User & { password: string }> = {
  'admin@centro.com': {
    id: '1',
    nombre: 'Dr. Carlos Rodriguez',
    email: 'admin@centro.com',
    role: 'admin',
    password: '123456'
  },
  'medico@centro.com': {
    id: '2',
    nombre: 'Dra. Maria Garcia',
    email: 'medico@centro.com',
    role: 'medico',
    password: '123456'
  },
  'recepcion@centro.com': {
    id: '3',
    nombre: 'Ana Martinez',
    email: 'recepcion@centro.com',
    role: 'recepcion',
    password: '123456'
  },
  'lab@centro.com': {
    id: '4',
    nombre: 'Luis Perez',
    email: 'lab@centro.com',
    role: 'laboratorio',
    password: '123456'
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Verificar si hay sesion guardada
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch {
        localStorage.removeItem('user')
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    // Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 800))
    
    const mockUser = MOCK_USERS[email.toLowerCase()]
    if (mockUser && mockUser.password === password) {
      const { password: _, ...userWithoutPassword } = mockUser
      setUser(userWithoutPassword)
      localStorage.setItem('user', JSON.stringify(userWithoutPassword))
      return true
    }
    return false
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
