'use client'

import { useState } from 'react'
import { FaSearch, FaFlask, FaCheckCircle, FaClock, FaEye, FaPrint, FaCheck } from 'react-icons/fa'
import { RESULTADOS } from '@/lib/mock-data'

export default function ResultadosPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [selectedResultado, setSelectedResultado] = useState<typeof RESULTADOS[0] | null>(null)

  const filteredResultados = RESULTADOS.filter(r => {
    const matchSearch = r.pacienteNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.estudio.toLowerCase().includes(searchTerm.toLowerCase())
    const matchEstado = filtroEstado === 'todos' || r.estado === filtroEstado
    return matchSearch && matchEstado
  })

  const pendientes = RESULTADOS.filter(r => r.estado === 'pendiente').length
  const validados = RESULTADOS.filter(r => r.estado === 'validado').length

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-500/20">
            <FaClock className="text-xl text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pendientes de Validacion</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{pendientes}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
            <FaCheckCircle className="text-xl text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Validados Hoy</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{validados}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por paciente o estudio..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#1c2029] border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFiltroEstado('todos')}
              className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${
                filtroEstado === 'todos'
                  ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroEstado('pendiente')}
              className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${
                filtroEstado === 'pendiente'
                  ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setFiltroEstado('validado')}
              className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${
                filtroEstado === 'validado'
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              Validados
            </button>
          </div>
        </div>
      </div>

      {/* Results list */}
      <div className="space-y-3">
        {filteredResultados.map(resultado => (
          <div 
            key={resultado.id}
            className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1">
                <div className={`p-3 rounded-xl ${
                  resultado.estado === 'validado'
                    ? 'bg-emerald-100 dark:bg-emerald-500/20'
                    : 'bg-amber-100 dark:bg-amber-500/20'
                }`}>
                  <FaFlask className={`text-xl ${
                    resultado.estado === 'validado'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 dark:text-white">{resultado.estudio}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{resultado.pacienteNombre}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{resultado.fecha}</p>
                  
                  {resultado.estado === 'validado' && resultado.medicoValidador && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                      Validado por: {resultado.medicoValidador}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  resultado.estado === 'validado'
                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                }`}>
                  {resultado.estado === 'validado' ? 'Validado' : 'Pendiente'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
              <button 
                onClick={() => setSelectedResultado(resultado)}
                className="px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-600 dark:text-slate-400 text-sm font-medium transition-colors flex items-center gap-2"
              >
                <FaEye />
                Ver
              </button>
              <button className="px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-600 dark:text-slate-400 text-sm font-medium transition-colors flex items-center gap-2">
                <FaPrint />
                Imprimir
              </button>
              {resultado.estado === 'pendiente' && (
                <button className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-cyan-500/25">
                  <FaCheck />
                  Validar
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredResultados.length === 0 && (
          <div className="bg-white dark:bg-card-dark rounded-xl p-12 border border-slate-200 dark:border-white/5 shadow-sm text-center">
            <FaFlask className="text-5xl text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">No hay resultados</h3>
            <p className="text-slate-500 dark:text-slate-400">
              No se encontraron resultados con los filtros seleccionados
            </p>
          </div>
        )}
      </div>

      {/* Result detail modal */}
      {selectedResultado && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card-dark rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-white/5 bg-gradient-to-r from-cyan-500 to-teal-500">
              <div className="flex items-center justify-between text-white">
                <div>
                  <p className="text-sm opacity-80">Resultado de Laboratorio</p>
                  <p className="text-xl font-bold">{selectedResultado.estudio}</p>
                </div>
                <FaFlask className="text-4xl opacity-50" />
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Paciente</p>
                  <p className="font-semibold text-slate-800 dark:text-white">{selectedResultado.pacienteNombre}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Fecha</p>
                  <p className="font-semibold text-slate-800 dark:text-white">{selectedResultado.fecha}</p>
                </div>
              </div>

              {/* Mock results table */}
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Resultados</p>
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/10">
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Parametro</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">Resultado</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">Unidad</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">Ref.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                      <tr>
                        <td className="px-4 py-3 text-slate-800 dark:text-white">Hemoglobina</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-800 dark:text-white">14.2</td>
                        <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">g/dL</td>
                        <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">12-16</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-slate-800 dark:text-white">Hematocrito</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-800 dark:text-white">42.5</td>
                        <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">%</td>
                        <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">36-48</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-slate-800 dark:text-white">Leucocitos</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-800 dark:text-white">7,500</td>
                        <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">/mm3</td>
                        <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">5,000-10,000</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-slate-800 dark:text-white">Plaquetas</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-800 dark:text-white">245,000</td>
                        <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">/mm3</td>
                        <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">150,000-400,000</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setSelectedResultado(null)}
                  className="flex-1 py-2.5 px-4 border border-slate-200 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                  Cerrar
                </button>
                <button className="flex-1 py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2">
                  <FaPrint />
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
