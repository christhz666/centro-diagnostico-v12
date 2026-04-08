'use client'

import { useState } from 'react'
import { FaSearch, FaPlus, FaUser, FaIdCard, FaPhone, FaEnvelope, FaMapMarkerAlt, FaCalendar, FaVenusMars } from 'react-icons/fa'
import { PACIENTES, ESTUDIOS, Paciente } from '@/lib/mock-data'

export default function RegistroPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null)
  const [selectedEstudios, setSelectedEstudios] = useState<string[]>([])
  const [showNewPatientForm, setShowNewPatientForm] = useState(false)

  const filteredPacientes = PACIENTES.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cedula.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const total = ESTUDIOS
    .filter(e => selectedEstudios.includes(e.id))
    .reduce((sum, e) => sum + e.precio, 0)

  const toggleEstudio = (id: string) => {
    setSelectedEstudios(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Buscar/Seleccionar Paciente */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm">
          <h2 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <FaUser className="text-cyan-500" />
            Seleccionar Paciente
          </h2>
          
          {/* Search */}
          <div className="relative mb-4">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o cedula..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#1c2029] border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          {/* New patient button */}
          <button
            onClick={() => setShowNewPatientForm(true)}
            className="w-full mb-4 py-2.5 px-4 border-2 border-dashed border-slate-300 dark:border-white/20 rounded-xl text-slate-600 dark:text-slate-400 hover:border-cyan-500 hover:text-cyan-500 transition-colors flex items-center justify-center gap-2"
          >
            <FaPlus />
            Nuevo Paciente
          </button>

          {/* Patient list */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredPacientes.map(paciente => (
              <button
                key={paciente.id}
                onClick={() => setSelectedPaciente(paciente)}
                className={`w-full p-3 rounded-xl text-left transition-all ${
                  selectedPaciente?.id === paciente.id
                    ? 'bg-cyan-50 dark:bg-cyan-500/10 border-2 border-cyan-500'
                    : 'bg-slate-50 dark:bg-white/5 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                <p className="font-semibold text-slate-800 dark:text-white text-sm">{paciente.nombre}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{paciente.cedula}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Selected patient info */}
        {selectedPaciente && (
          <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm">
            <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Informacion del Paciente</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <FaIdCard className="text-cyan-500" />
                <span>{selectedPaciente.cedula}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <FaPhone className="text-cyan-500" />
                <span>{selectedPaciente.telefono}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <FaEnvelope className="text-cyan-500" />
                <span>{selectedPaciente.email}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <FaCalendar className="text-cyan-500" />
                <span>{new Date(selectedPaciente.fechaNacimiento).toLocaleDateString('es-ES')}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <FaVenusMars className="text-cyan-500" />
                <span>{selectedPaciente.sexo === 'M' ? 'Masculino' : 'Femenino'}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <FaMapMarkerAlt className="text-cyan-500" />
                <span>{selectedPaciente.direccion}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Estudios disponibles */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm">
          <h2 className="font-semibold text-slate-800 dark:text-white mb-4">Estudios Disponibles</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ESTUDIOS.map(estudio => (
              <button
                key={estudio.id}
                onClick={() => toggleEstudio(estudio.id)}
                className={`p-4 rounded-xl text-left transition-all ${
                  selectedEstudios.includes(estudio.id)
                    ? 'bg-cyan-50 dark:bg-cyan-500/10 border-2 border-cyan-500'
                    : 'bg-slate-50 dark:bg-white/5 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-white text-sm">{estudio.nombre}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{estudio.codigo} - {estudio.categoria}</p>
                  </div>
                  <span className="text-cyan-600 dark:text-[#3df5e7] font-bold">${estudio.precio.toFixed(2)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Resumen */}
        {(selectedPaciente && selectedEstudios.length > 0) && (
          <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm">
            <h2 className="font-semibold text-slate-800 dark:text-white mb-4">Resumen de la Orden</h2>
            
            <div className="space-y-2 mb-4">
              {ESTUDIOS.filter(e => selectedEstudios.includes(e.id)).map(estudio => (
                <div key={estudio.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/5">
                  <span className="text-slate-600 dark:text-slate-400">{estudio.nombre}</span>
                  <span className="font-medium text-slate-800 dark:text-white">${estudio.precio.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between py-3 border-t-2 border-slate-200 dark:border-white/10">
              <span className="font-bold text-slate-800 dark:text-white">Total</span>
              <span className="text-2xl font-bold text-cyan-600 dark:text-[#3df5e7]">${total.toFixed(2)}</span>
            </div>

            <button className="w-full mt-4 py-3 px-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/25 transition-all">
              Generar Orden
            </button>
          </div>
        )}
      </div>

      {/* Modal nuevo paciente */}
      {showNewPatientForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card-dark rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Nuevo Paciente</h2>
            
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre completo</label>
                  <input type="text" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#1c2029] border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cedula</label>
                  <input type="text" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#1c2029] border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefono</label>
                  <input type="tel" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#1c2029] border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input type="email" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#1c2029] border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha de nacimiento</label>
                  <input type="date" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#1c2029] border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sexo</label>
                  <select className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#1c2029] border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Direccion</label>
                <input type="text" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#1c2029] border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewPatientForm(false)}
                  className="flex-1 py-2.5 px-4 border border-slate-200 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/25"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
