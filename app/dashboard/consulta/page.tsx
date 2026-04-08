'use client'

import { useState } from 'react'
import { FaSearch, FaUser, FaIdCard, FaPhone, FaEnvelope, FaCalendar, FaEye, FaPrint, FaHistory } from 'react-icons/fa'
import { PACIENTES, CITAS, Paciente } from '@/lib/mock-data'

export default function ConsultaPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null)

  const filteredPacientes = searchTerm.length >= 2 
    ? PACIENTES.filter(p => 
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.cedula.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : []

  const pacienteCitas = selectedPaciente 
    ? CITAS.filter(c => c.pacienteId === selectedPaciente.id)
    : []

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="relative max-w-2xl mx-auto">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar paciente por nombre o cedula..."
            className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-[#1c2029] border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-lg"
          />
        </div>
        
        {/* Quick help */}
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-3">
          Escribe al menos 2 caracteres para buscar
        </p>
      </div>

      {/* Search results */}
      {filteredPacientes.length > 0 && !selectedPaciente && (
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/5">
            <h3 className="font-semibold text-slate-800 dark:text-white">
              Resultados ({filteredPacientes.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {filteredPacientes.map(paciente => (
              <button
                key={paciente.id}
                onClick={() => setSelectedPaciente(paciente)}
                className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-teal-400 flex items-center justify-center text-white font-bold">
                  {paciente.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800 dark:text-white">{paciente.nombre}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{paciente.cedula} | {paciente.telefono}</p>
                </div>
                <FaEye className="text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Patient details */}
      {selectedPaciente && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient info */}
          <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <FaUser className="text-cyan-500" />
                Datos del Paciente
              </h3>
              <button
                onClick={() => setSelectedPaciente(null)}
                className="text-sm text-cyan-500 hover:underline"
              >
                Cerrar
              </button>
            </div>

            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-teal-400 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3">
                {selectedPaciente.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">{selectedPaciente.nombre}</h2>
              <p className="text-slate-500 dark:text-slate-400">{selectedPaciente.cedula}</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 p-3 bg-slate-50 dark:bg-white/5 rounded-lg">
                <FaPhone className="text-cyan-500" />
                <span>{selectedPaciente.telefono}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 p-3 bg-slate-50 dark:bg-white/5 rounded-lg">
                <FaEnvelope className="text-cyan-500" />
                <span>{selectedPaciente.email}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 p-3 bg-slate-50 dark:bg-white/5 rounded-lg">
                <FaCalendar className="text-cyan-500" />
                <span>{new Date(selectedPaciente.fechaNacimiento).toLocaleDateString('es-ES')}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 flex gap-2">
              <button className="flex-1 py-2 px-3 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition-colors">
                Editar
              </button>
              <button className="flex-1 py-2 px-3 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                Historial
              </button>
            </div>
          </div>

          {/* Patient history */}
          <div className="lg:col-span-2 bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm">
            <h3 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <FaHistory className="text-cyan-500" />
              Historial de Visitas
            </h3>

            {pacienteCitas.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <FaHistory className="text-4xl mx-auto mb-3 opacity-30" />
                <p>No hay visitas registradas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pacienteCitas.map(cita => {
                  const estadoStyles = {
                    pendiente: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
                    en_proceso: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
                    completado: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
                    cancelado: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
                  }
                  
                  return (
                    <div key={cita.id} className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-white">{cita.fecha}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{cita.hora}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${estadoStyles[cita.estado]}`}>
                          {cita.estado.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {cita.estudios.map((estudio, i) => (
                          <span key={i} className="px-2 py-1 bg-white dark:bg-card-dark rounded-md text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10">
                            {estudio}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-600 dark:text-[#3df5e7]">${cita.total.toFixed(2)}</span>
                        <div className="flex gap-2">
                          <button className="p-2 hover:bg-white dark:hover:bg-card-dark rounded-lg text-slate-400 hover:text-cyan-500 transition-colors">
                            <FaEye />
                          </button>
                          <button className="p-2 hover:bg-white dark:hover:bg-card-dark rounded-lg text-slate-400 hover:text-cyan-500 transition-colors">
                            <FaPrint />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!selectedPaciente && filteredPacientes.length === 0 && searchTerm.length >= 2 && (
        <div className="bg-white dark:bg-card-dark rounded-xl p-12 border border-slate-200 dark:border-white/5 shadow-sm text-center">
          <FaSearch className="text-5xl text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">No se encontraron resultados</h3>
          <p className="text-slate-500 dark:text-slate-400">
            No hay pacientes que coincidan con &quot;{searchTerm}&quot;
          </p>
        </div>
      )}
    </div>
  )
}
