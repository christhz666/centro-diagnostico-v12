'use client'

import { FaUsers, FaCalendarCheck, FaFlask, FaDollarSign, FaArrowUp, FaClock } from 'react-icons/fa'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { ESTADISTICAS, DATOS_GRAFICO_SEMANAL, DATOS_ESTUDIOS_POPULARES, CITAS } from '@/lib/mock-data'

const COLORS = ['#0891b2', '#14b8a6', '#06b6d4', '#22d3d1', '#67e8f9', '#a5f3fc']

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: { value: number; positive: boolean }
  color: string
}

function StatCard({ title, value, subtitle, icon, trend, color }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{title}</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.positive ? 'text-emerald-500' : 'text-red-500'}`}>
              <FaArrowUp className={`${!trend.positive && 'rotate-180'}`} />
              {trend.value}% vs ayer
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function CitaCard({ cita }: { cita: typeof CITAS[0] }) {
  const estadoStyles = {
    pendiente: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
    en_proceso: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
    completado: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    cancelado: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  }

  const estadoLabels = {
    pendiente: 'Pendiente',
    en_proceso: 'En Proceso',
    completado: 'Completado',
    cancelado: 'Cancelado',
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold text-sm">
        {cita.hora}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 dark:text-white truncate">{cita.pacienteNombre}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{cita.estudios.join(', ')}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${estadoStyles[cita.estado]}`}>
          {estadoLabels[cita.estado]}
        </span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">${cita.total.toFixed(2)}</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pacientes Hoy"
          value={ESTADISTICAS.pacientesHoy}
          subtitle={`${ESTADISTICAS.pacientesSemana} esta semana`}
          icon={<FaUsers className="text-xl text-cyan-600 dark:text-cyan-400" />}
          trend={{ value: 12, positive: true }}
          color="bg-cyan-100 dark:bg-cyan-500/20"
        />
        <StatCard
          title="Citas Pendientes"
          value={ESTADISTICAS.citasPendientes}
          subtitle={`${ESTADISTICAS.citasCompletadas} completadas hoy`}
          icon={<FaCalendarCheck className="text-xl text-emerald-600 dark:text-emerald-400" />}
          color="bg-emerald-100 dark:bg-emerald-500/20"
        />
        <StatCard
          title="Resultados Pendientes"
          value={ESTADISTICAS.resultadosPendientes}
          subtitle="Por validar"
          icon={<FaFlask className="text-xl text-violet-600 dark:text-violet-400" />}
          color="bg-violet-100 dark:bg-violet-500/20"
        />
        <StatCard
          title="Ingresos del Dia"
          value={`$${ESTADISTICAS.ingresosDia.toFixed(2)}`}
          subtitle={`$${ESTADISTICAS.ingresosMes.toFixed(2)} este mes`}
          icon={<FaDollarSign className="text-xl text-amber-600 dark:text-amber-400" />}
          trend={{ value: 8, positive: true }}
          color="bg-amber-100 dark:bg-amber-500/20"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm">
          <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Actividad Semanal</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DATOS_GRAFICO_SEMANAL}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
                <XAxis dataKey="dia" tick={{ fill: 'currentColor' }} className="text-slate-500 dark:text-slate-400 text-xs" />
                <YAxis tick={{ fill: 'currentColor' }} className="text-slate-500 dark:text-slate-400 text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="pacientes" fill="#0891b2" radius={[4, 4, 0, 0]} name="Pacientes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm">
          <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Estudios Populares</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={DATOS_ESTUDIOS_POPULARES}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="cantidad"
                >
                  {DATOS_ESTUDIOS_POPULARES.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {DATOS_ESTUDIOS_POPULARES.slice(0, 4).map((item, index) => (
              <div key={item.nombre} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                  <span className="text-slate-600 dark:text-slate-400">{item.nombre}</span>
                </div>
                <span className="font-medium text-slate-800 dark:text-white">{item.porcentaje}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Citas del dia */}
      <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <FaClock className="text-cyan-500" />
            Citas del Dia
          </h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {CITAS.map((cita) => (
            <CitaCard key={cita.id} cita={cita} />
          ))}
        </div>
      </div>
    </div>
  )
}
