'use client'

import { useState } from 'react'
import { FaSearch, FaFileInvoice, FaEye, FaPrint, FaCheck, FaClock, FaTimesCircle, FaPlus, FaFilter } from 'react-icons/fa'
import { CITAS } from '@/lib/mock-data'

const FACTURAS = CITAS.map((cita, i) => ({
  id: `FAC-${String(i + 1001).padStart(6, '0')}`,
  paciente: cita.pacienteNombre,
  fecha: cita.fecha,
  estudios: cita.estudios,
  subtotal: cita.total,
  iva: cita.total * 0.16,
  total: cita.total * 1.16,
  estado: cita.estado === 'completado' ? 'pagada' : cita.estado === 'cancelado' ? 'anulada' : 'pendiente',
  metodoPago: cita.estado === 'completado' ? 'Efectivo' : '-',
}))

export default function FacturasPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [selectedFactura, setSelectedFactura] = useState<typeof FACTURAS[0] | null>(null)

  const filteredFacturas = FACTURAS.filter(f => {
    const matchSearch = f.paciente.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        f.id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchEstado = filtroEstado === 'todos' || f.estado === filtroEstado
    return matchSearch && matchEstado
  })

  const estadoStyles = {
    pagada: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', icon: FaCheck },
    pendiente: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', icon: FaClock },
    anulada: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400', icon: FaTimesCircle },
  }

  const totales = {
    facturado: FACTURAS.filter(f => f.estado !== 'anulada').reduce((sum, f) => sum + f.total, 0),
    cobrado: FACTURAS.filter(f => f.estado === 'pagada').reduce((sum, f) => sum + f.total, 0),
    pendiente: FACTURAS.filter(f => f.estado === 'pendiente').reduce((sum, f) => sum + f.total, 0),
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Facturado</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">${totales.facturado.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Cobrado</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${totales.cobrado.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Por Cobrar</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">${totales.pendiente.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters and search */}
      <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por numero o paciente..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#1c2029] border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <FaFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="pl-10 pr-8 py-2.5 bg-slate-50 dark:bg-[#1c2029] border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none cursor-pointer"
              >
                <option value="todos">Todos</option>
                <option value="pagada">Pagadas</option>
                <option value="pendiente">Pendientes</option>
                <option value="anulada">Anuladas</option>
              </select>
            </div>
            <button className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/25 flex items-center gap-2">
              <FaPlus />
              <span className="hidden sm:inline">Nueva Factura</span>
            </button>
          </div>
        </div>
      </div>

      {/* Invoices table */}
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/5">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Factura</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Paciente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Estudios</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredFacturas.map(factura => {
                const EstadoIcon = estadoStyles[factura.estado as keyof typeof estadoStyles].icon
                return (
                  <tr key={factura.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-cyan-600 dark:text-[#3df5e7]">{factura.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-white">{factura.paciente}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-slate-600 dark:text-slate-400">{factura.fecha}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm text-slate-500 dark:text-slate-400">{factura.estudios.length} estudio(s)</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-slate-800 dark:text-white">${factura.total.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${estadoStyles[factura.estado as keyof typeof estadoStyles].bg} ${estadoStyles[factura.estado as keyof typeof estadoStyles].text}`}>
                          <EstadoIcon className="text-[10px]" />
                          {factura.estado}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => setSelectedFactura(factura)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-cyan-500 transition-colors"
                        >
                          <FaEye />
                        </button>
                        <button className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-cyan-500 transition-colors">
                          <FaPrint />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice detail modal */}
      {selectedFactura && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card-dark rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-white/5 bg-gradient-to-r from-cyan-500 to-teal-500">
              <div className="flex items-center justify-between text-white">
                <div>
                  <p className="text-sm opacity-80">Factura</p>
                  <p className="text-xl font-bold font-mono">{selectedFactura.id}</p>
                </div>
                <FaFileInvoice className="text-4xl opacity-50" />
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Paciente</p>
                  <p className="font-semibold text-slate-800 dark:text-white">{selectedFactura.paciente}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Fecha</p>
                  <p className="font-semibold text-slate-800 dark:text-white">{selectedFactura.fecha}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Estudios</p>
                <div className="space-y-2">
                  {selectedFactura.estudios.map((estudio, i) => (
                    <div key={i} className="flex justify-between py-2 border-b border-slate-100 dark:border-white/5">
                      <span className="text-slate-600 dark:text-slate-400">{estudio}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Subtotal</span>
                  <span className="text-slate-800 dark:text-white">${selectedFactura.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">IVA (16%)</span>
                  <span className="text-slate-800 dark:text-white">${selectedFactura.iva.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-white/10">
                  <span className="font-bold text-slate-800 dark:text-white">Total</span>
                  <span className="font-bold text-xl text-cyan-600 dark:text-[#3df5e7]">${selectedFactura.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setSelectedFactura(null)}
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
